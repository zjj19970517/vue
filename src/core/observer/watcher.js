/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component, // Vue 实例
    expOrFn: string | Function, // 访问路径或者是函数
    cb: Function, // 回调函数
    options?: ?Object, // 其他选项
    isRenderWatcher?: boolean  // 是否为渲染Watcher
  ) {
    // 当前实例绑定 vm 属性
    // new Watcher().vm 是要观察的当前实例
    this.vm = vm

    // 如果是 Render Watcher
    // 通常每一个 Vue 实例都有一个 render Watcher（来源于 render 函数）
    if (isRenderWatcher) {
      vm._watcher = this
    }

    // 实例上会有一个 _watchers 来统计所有的 watcher
    vm._watchers.push(this)

    // 处理选项配置
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }

    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true // watcher 已经被激活
    this.dirty = this.lazy // for lazy watchers

    // 表示 Watcher 实例持有的 Dep 实例的数组
    // 在 addDep 时会起到关键作用
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()

    // parse expression for getter
    // 设置访问器
    if (typeof expOrFn === 'function') {
      // 如果是函数，直接赋值
      this.getter = expOrFn
    } else {
      // 如果为路径，则返回一个函数用来访问该路径上的数据
      this.getter = parsePath(expOrFn)
    }

    // 调用 get 方法，返回 getter 执行后的结果
    // 核心功能在 get 方法中实现
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 将当前 Watcher 实例，设置到 Dep.target 上，并压栈
    pushTarget(this)

    let value
    const vm = this.vm
    try {
      // 调用访问器
      // 目的是触发数据对象的 getter，进行依赖收集
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 如果需要深度处理，则要递归去访问 value，触发它所有子项的 getter
      if (this.deep) {
        traverse(value)
      }
      // 当前 Watcher 出栈，Dep.target 恢复成上一个状态
      popTarget()
      // 清空自身状态
      this.cleanupDeps()
    }

    // 最后返回 getter 执行后的结果
    return value
  }

  // 实现对依赖（Watcher）的订阅
  addDep (dep: Dep) {
    const id = dep.id
    // 考虑到 Vue 是数据驱动的，所以每次数据变化都会重新 render，
    // 那么 vm._render() 方法又会再次执行，并再次触发数据的 getters
    // newDeps 表示新添加的 Dep 实例数组，而 deps 表示上一次添加的 Dep 实例数组。
    // 重复依赖不会处理
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        // 最终完成依赖的收集的最后一步
        dep.addSub(this)
      }
    }
  }

  /**
   * 依赖清空的过程
   */
  cleanupDeps () {
    let i = this.deps.length
    // newDepIds 是我们最新一次执行getter收集到的
    while (i--) {
      const dep = this.deps[i]
      // newDepIds 中已经没有了，那么就说明不存在这个dep了
      // 那么该 dep 中也不需要当前 Watcher 作为依赖了
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    // 把 newDepIds 和 depIds 交换，newDeps 和 deps 交换，并把 newDepIds 和 newDeps 清空。
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    if (this.lazy) {
      // 懒执行，比如 computed
      // dirty 是懒执行的关键
      this.dirty = true
    } else if (this.sync) {
      // 非异步，直接执行
      // 在使用 vm.$watch 或者 watch 选项时可以传一个 sync 选项，
      // 当为 true 的时候，在数据更新时 Watcher 不会走异步更新队列，会直接走 run 方法进行更新
      // 同步执行会有性能问题，所以不建议使用，而且 官方文档 里也没有开发这个配置项
      this.run()
    } else {
      // 通常情况下，会在下次 tick 的时候统一执行
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      // 通过 this.get() 得到它当前的值
      // get 里执行了依赖收集
      // 更新阶段还要执行依赖收集？
      // 答：当然；
      const value = this.get()

      // 如果满足新旧值不等、新值是对象类型、deep 模式任何一个条件，
      // 则执行 watcher 的回调，注意回调函数执行的时候会把第一个和第二个参数传入新值 value 和旧值 oldValue，这就是当我们添加自定义 watcher 的时候能在回调函数的参数中拿到新旧值的原因。
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        // 执行回调函数，传回新旧值
        if (this.user) {
          const info = `callback for watcher "${this.expression}"`
          invokeWithErrorHandling(this.cb, this.vm, [value, oldValue], this.vm, info)
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        // 移除 vm 实例上 _watchers 中收集的当前 Watcher 实例
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      // 遍历所有的 dep，通知它们将自己从它们的依赖列表里删除
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
