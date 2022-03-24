/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute,
  invokeWithErrorHandling
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/**
 * 数据响应式处理的入口
 * 1. 分别处理 props、methods、data、computed、watch
 * 2. 优先级：props、methods、data、computed 对象中的属性不能出现重复，优先级和列出顺序一致
 *          其中 computed 中的 key 不能和 props、data 中的 key 重复，methods 不影响
 * @param {*} vm vue 当前实例
 */
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options // 获取配置选项
  // 处理 props 对象，为 props 对象的每个属性设置响应式，并将其代理到 vm 实例上
  if (opts.props) initProps(vm, opts.props)
  // 处理 methods 对象，校验每个属性的值是否为函数、和 props 属性比对进行判重处理，最后得到 vm[key] = methods[key]
  if (opts.methods) initMethods(vm, opts.methods)

  // 初始化 data
  // 1、判重处理，data 对象上的属性不能和 props、methods 对象上的属性相同
  // 2、代理 data 对象上的属性到 vm 实例
  // 3、为 data 对象的上数据设置响应式
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }

  // 初始化 computed
  if (opts.computed) initComputed(vm, opts.computed)

  // 初始化 watch
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

/**
 * 处理 props 对象，为 props 对象的每个属性设置响应式，并将其代理到 vm 实例上
 * @param {*} vm
 * @param {*} propsOptions
 */
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  // vue 实例上挂在一个属性 _props
  const props = vm._props = {}
  // vm.$options._propKeys 存放所有的 props key
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    // 校验 Props，取得默认值
    const value = validateProp(key, propsOptions, propsData, vm)
    // 核心代码在这里，对 props 做响应式处理
    // 调用 defineReactive 方法把每个 prop 对应的值变成响应式，
    // 可以通过 vm._props.xxx 访问到定义 props 中对应的属性
    defineReactive(props, key, value)

    // 将 key 代理到 vue 实例上
    // this._props[key]
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }

  toggleObserving(true)
}

function initData (vm: Component) {
  // 读取选项配置中的 data 选项
  let data = vm.$options.data

  // 根据 data 的类型，最终获得 data 对象
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}

  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length

  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      // methods 和 data 中有重复属性的问题
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      // props 和 data 中有重复属性的问题
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      // 将 vm._data 上的属性代理到 vm 上
      // 确保 vm[key] 可以直接访问到
      proxy(vm, `_data`, key)
    }
  }

  // 针对 data 完成响应式处理
  // 侦测 data 的变化
  observe(data, true)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  // 实例的 vm._computedWatchers 会记录所有的 computed watcher
  const watchers = vm._computedWatchers = Object.create(null)
  // 是否为 SSR 服务端渲染
  const isSSR = isServerRendering()

  // 遍历 computed 对象选项的值
  for (const key in computed) {
    // 获取 computed 值
    const userDef = computed[key]
    // 取得 getter 访问函数
    const getter = typeof userDef === 'function' ? userDef : userDef.get

    // 非 SSR 下，实例化
    if (!isSSR) {
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions // computed 默认是 lazy 的
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      // 将 computed 属性代理至 vm 实例上，方便使用 this.xx 直接访问
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      // 命名重复，给出警告
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      } else if (vm.$options.methods && key in vm.$options.methods) {
        warn(`The computed property "${key}" is already defined as a method.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  // 非服务端渲染的场景下需要缓存
  const shouldCache = !isServerRendering()

  // 函数形式
  if (typeof userDef === 'function') {
    // 核心是 createComputedGetter
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    // 对象形式
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 完成对 computed 属性 getter 创建
function createComputedGetter (key) {
  // 这里是一个闭包
  return function computedGetter () {
    // 最后这个函数执行的时候，key 值可以访问到
    const watcher = this._computedWatchers && this._computedWatchers[key]
    // 取得针对当前 key 的 watcher 侦听器
    if (watcher) {
      // 如果数据已经脏了（脏了意思就是内部的响应式数据更新了）
      if (watcher.dirty) {
        // watcher.evaluate 内部会调用 watcher.get 重新计算 watcher.value
        watcher.evaluate()
      }
      // FIXME: 这里还是有点迷糊
      // Dep.target 有值的情况下，应该是在诸如 render 的调用下
      if (Dep.target) {
        watcher.depend()
      }
      // 返回最新的值（如果没脏，返回上一次的计算值）
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

//
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        // methods 中有 key 跟 props 里重复了
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      // methods 中的 key 已经在 实例 上存在了
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 最后将 methods 上的方法挂载到 实例上
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

/**
 * 初始化 Watch 选项配置
 * @param {*} vm 当前实例
 * @param {Object} watch watch 集合
 */
function initWatch (vm: Component, watch: Object) {
  // 遍历每一个用户的 自定义 watch
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      // 数组的情况下，执行遍历处理
      // 核心是 createWatcher 方法，会创建一个 user Watcher
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // 核心逻辑是解析出 options 选项配置 和 handler 回调函数
  // 处理是对象类型的情况
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // 处理是字符串的情况
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  // 本质还是调用 vm.$watch 来完成
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  /**
   * @param {*} expOrFn expOrFn 为属性访问路径或者是一个函数
   * @param {*} cb 回调函数
   * @param {*} options 选项配置
   * @returns
   */
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    // cb 是一个对象，直接走 createWatcher
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    // user 设置为 true，表示是 user Watcher 的类型
    options.user = true
    // 实例化一个 User Watcher
    const watcher = new Watcher(vm, expOrFn, cb, options)

    // 立即执行
    // 即不需要等待属性变化，立刻执行回调
    if (options.immediate) {
      const info = `callback for immediate watcher "${watcher.expression}"`
      pushTarget()
      invokeWithErrorHandling(cb, vm, [watcher.value], vm, info)
      popTarget()
    }

    // 返回一个取消 watch 的函数，用来终止 watch
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
