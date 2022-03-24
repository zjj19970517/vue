/* @flow */

import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import { unicodeRegExp } from './lang'
import { nativeWatch, hasSymbol } from './env'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== 'production') {
  // 只允许vue实例才拥有el属性，其他子类构造器不允许有el属性
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 * to = 子
 * from = 父
 */
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal

  // Reflect.ownKeys 可以拿到 Symbol 属性
  const keys = hasSymbol
    ? Reflect.ownKeys(from)
    : Object.keys(from)

  // 遍历所有的 from 上的 key
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    // in case the object is already observed...
    if (key === '__ob__') continue
    toVal = to[key] // 子类 data 上的值
    fromVal = from[key] // 父类 data 上的值
    // 如果子类 data 上没有这个key值
    if (!hasOwn(to, key)) {
      // 子类对象上增加改key，值为 父类 上的值
      set(to, key, fromVal)
    } else if (
      toVal !== fromVal &&
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
    ) {
      // 如果子类 data 上有这个key值且都是 对象
      // 递归去对别吧
      mergeData(toVal, fromVal)
    }
  }
  // 返回子类的 data 选项
  return to
}

/**
 * 合并 data 选项
 */
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // 子组件（子父关系）
    // 子类不存在 data 选项
    if (!childVal) {
      return parentVal
    }
    // 父类不存在 data 选项
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.

    // 子类和父类都存在 data 选项
    // 返回一个函数
    return function mergedDataFn () {
      // 函数返回值是一个新的处理结果
      // 入参做了区分，如果为函数类型，返回的是函数执行后的结果；反之就是 data 对象
      // BIZ_STATES: 这就是为什么我们一定要在Vue组件中使用函数类型作为data的值了。原因就是因为，如果创建多个组件实例的话，data
      // 属性值都会指向最开始的那一个值，一个变动，其他所有组件因为有对象引用关系，因此都会发生变化，这显然是很恐怖的了

      // 分别将子类和父类实例中 data 函数执行后返回的对象传递给 mergeData 函数做数据合并
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {
    // Vue 实例
    // 也是返回一个函数
    return function mergedInstanceDataFn () {
      // instance merge
      // 实例的 data
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm, vm)
        : childVal

      // Vue 默认的 data
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal

      // 当实例中传递 data 选项时，将实例的 data 对象和Vm构造函数上的 data 属性选项合并
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        // 当实例中不传递 data 时，默认返回 Vue 构造函数上的 data 属性选项
        return defaultData
      }
    }
  }
}

strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 */
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  const res = childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
  return res
    ? dedupeHooks(res)
    : res
}

function dedupeHooks (hooks) {
  const res = []
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i])
    }
  }
  return res
}

LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  const res = Object.create(parentVal || null)
  if (childVal) {
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } else {
    return res
  }
}

ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  if (!childVal) return Object.create(parentVal || null)
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 */
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  if (childVal && process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = Object.create(null)
  extend(ret, parentVal)
  if (childVal) extend(ret, childVal)
  return ret
}
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 * 校验组件名
 */
function checkComponents (options: Object) {
  for (const key in options.components) {
    validateComponentName(key)
  }
}

export function validateComponentName (name: string) {
  // 正则判断检测是否为非法的标签，例如数字开头
  if (!new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)) {
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'should conform to valid custom element name in html5 specification.'
    )
  }
  // 不能使用 Vue 自身自定义的组件名，如slot, component,
  // 不能使用 html 的保留标签，如 h1, svg等
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}

/**
 * 规范化处理 props
 */
function normalizeProps (options: Object, vm: ?Component) {
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  // 数组形式 ['a', 'b', 'c']
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        name = camelize(val)
        // 最终也会转换为对象形式，只不过 type 为 null 了
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
    // { a: 'String' }
    // { a: { type: 'String', default: '' } }
    for (const key in props) {
      val = props[key]
      // key 如果为连字符，转为驼峰形式
      name = camelize(key)
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}

/**
 * 规范化 inject
 */
function normalizeInject (options: Object, vm: ?Component) {
  const inject = options.inject
  if (!inject) return
  const normalized = options.inject = {}
  // 处理数组形式
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {
    // 处理对象形式
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 */
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        // 处理函数类型
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * 选项合并
 * @param {*} parent 基类的选项
 * @param {*} child 当前的选项
 * @param {*} vm
 * @returns
 */
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {

  // 组件校验，主要完成组件名的校验（不能以数字开头，不能更component、slot重名）
  checkComponents(child)

  // Vue 提供了多种配置方式供开发者使用，内部想要统一处理就必须要做规范化
  // props,inject,directives 的校验和规范化
  normalizeProps(child, vm)
  normalizeInject(child, vm)
  normalizeDirectives(child)

  // 下面才是选型合并的真正开始：

  // 这段代码主要是用来处理 extends 和 mixin 的，递归调用自身(mergeOptions方法)。
  // eg：
  // var app = new Vue({
  //   el: '#app',
  //   data(){
  //     return {
  //       name: 'hello'
  //     }
  //   }
  // })
  // 上面例中，child._base = Vue, 所以这段逻辑是不会进来的
  // 子组件上应用 mixin、extends
  if (!child._base) {
    // 根组件才有 _base
    // 合并 extends
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm)
    }
    // 合并 mixins
    if (child.mixins) {
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm)
      }
    }
  }

  // 最终导出的结果选项
  const options = {}
  let key
  for (key in parent) {
    // 先处理 parent 上的 key
    // 执行合并策略
    mergeField(key)
  }

  for (key in child) {
    // 再处理 child 上的 key，并且该 key 不在 parent 上
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }

  // 混合字段
  function mergeField (key) {
    // 合并策略
    // 如果该字段有特殊的合并策略，便使用，反之使用默认的合并策略
    // 默认的合并策略是 child 覆盖 parent
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
