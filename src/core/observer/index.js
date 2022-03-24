/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */

/**
 * Observer 是一个类，它的作用是给属性添加 getter、setter 方法，同时完成依赖收集和派发更新通知；
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    // value 是一个对象
    this.value = value
    // 依赖收集使用的 Dep 订阅器
    this.dep = new Dep()
    this.vmCount = 0
    // 对象上定义 o.__ob__ 表示当前对象的响应式对象实例
    def(value, '__ob__', this)

    // 如果为数组，走数组的处理方式
    if (Array.isArray(value)) {
      if (hasProto) {
        // 对象上有 __proto__ 属性
        // __proto__ 是非标准属性，可能没有
        protoAugment(value, arrayMethods) // value.__proto__ = arrayMethods
      } else {
        // 对象上没有 __proto__ 属性
        // value.push = arrayMethods['push']
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 正式开始处理 Array 类型，将其响应式化处理
      this.observeArray(value)
    } else {
      // 对象的形式直接走 walk
      this.walk(value)
    }
  }

  // 遍历所有的属性，并进行数据劫持
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  // 遍历数组的每一项，然后针对每一项进行响应式处理
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

function protoAugment (target, src: Object) {
  target.__proto__ = src
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */

/**
 * 接收一个 value，将其转为响应式
 * @param {Object} value
 * @param {*} asRootData
 * @returns
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 非 Object 类型或者事 虚拟DOM 节点排除
  if (!isObject(value) || value instanceof VNode) {
    return
  }

  let ob: Observer | void
  // 如果有 __ob__ 属性 并且 __ob__ 属性的值属于 Observer 的实例
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&  // shouldObserve 是全局变量开关
    !isServerRendering() && // 非服务端渲染
    (Array.isArray(value) || isPlainObject(value)) && // 数组或者是纯对象
    Object.isExtensible(value) && // 对象可扩展
    !value._isVue // 不是 Vue 实例
  ) {
    // 响应式化处理该值
    ob = new Observer(value)
  }

  // 该响应式对象被使用的数量加一
  if (asRootData && ob) {
    ob.vmCount++
  }

  // 最后返回经过响应式化处理的对象
  return ob
}

/**
 * 处理对象的属性为响应式，完成数据劫持
 * 同时还包含有依赖收集 和 更新通知派发
 * @param {*} obj
 * @param {*} key
 * @param {*} val
 * @param {*} customSetter
 * @param {*} shallow
 * @returns
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean // 浅处理
) {
  // 定义一个订阅器，创建对依赖的管理
  const dep = new Dep()

  // 获取属性的描述对象
  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 属性不可配置，直接返回
  if (property && property.configurable === false) {
    return
  }

  // 取得原始的 getter、setter
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    // 获取其初始值
    val = obj[key]
  }

  // observe(val) 返回值有两种情况，如果 val 不是对象，或者是 VNode，会直接返回空；如果为对象，则会进行响应式处理
  // 所以这一部分的逻辑是针对深层次的对象的处理，其实就是我们期待的递归操作
  // 先对子对象完成响应式处理，返回值 childOb 就是一个响应式对象
  let childOb = !shallow && observe(val)

  // 重写 obj.key 的 getter、setter
  // key: ''          => childOb 为 false
  // key: { /* */ }   => childOb 有值
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      // 默认的 getter 方法执行，返回初始值
      // value 三种形式：
      // key: 'xxx'
      // key: { /*  */ }
      // key: [ /*  */ ]

      // 获取当前值
      const value = getter ? getter.call(obj) : val

      // Dep.target 指向的是一个当前的依赖上下文
      // 也就是一个 Watcher 上下文实例
      if (Dep.target) {
        // 收集依赖至 dep
        dep.depend()

        // 如果当前key的值是一个新的对象
        if (childOb) {
          // 通知嵌套的响应式对象也收集该依赖
          // 换一个思路理解：
          // data: { user: { name: 'zjj' } }
          // 这里执行了两次依赖收集，分别针对 user 和 { name: 'zjj' }
          // childOb 是针对 { name: 'zjj' } 的响应式对象
          childOb.dep.depend()

          // 数组需要特殊处理
          // 如果存在 childOb && childOb 是数组类型
          // 遍历数组 item ，完成对 item 的依赖收集
          if (Array.isArray(value)) {
            dependArray(value)
          }


          // FIXME: 为什么要处理子内容也进行依赖收集呢？
          //
        }
      }

      // 返回当前值
      return value
    },
    set: function reactiveSetter (newVal) {
      // 获取原始值
      const value = getter ? getter.call(obj) : val

      // 新旧值一样，直接返回
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }

      // 存在 getter 不存在 setter
      if (getter && !setter) return

      // 赋新值
      if (setter) {
        // 调用 setter 方法，赋新值
        setter.call(obj, newVal)
      } else {
        val = newVal
      }

      // 新值为对象时，会为新对象进行依赖收集过程
      childOb = !shallow && observe(newVal)

      // 派发依赖更新通知
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
// 触发数组 item 的 依赖收集
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
