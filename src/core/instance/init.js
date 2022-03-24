/* @flow */

import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions } from '../util/index'

let uid = 0

/**
 * 实例的初始化
 * @param {*} Vue Vue 构造函数
 */
export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    // vm 就是 this 实例对象
    const vm: Component = this

    // Vue 实例上的唯一ID
    vm._uid = uid++

    // a flag to avoid this being observed
    // _isVue标记是为了不让vue的响应式系统观测它
    vm._isVue = true

    // 选项合并和处理
    // merge option
    if (options && options._isComponent) {
      // Vue 内部处理组件实例化的
      // 子组件初始化时候走这里，做了一些性能优化
      // 将组件配置对象上的一些深层次属性放置在 vm.$options 中，以提高代码执行效率
      initInternalComponent(vm, options)
    } else {
      // 根组件走这里，完成选项合并，合并默认的选项和自定义选项
      // vm.constructor 为 Vue 构造函数
      // vm.constructor 上存在一些全局配置和属性，比如 vm.constructor.options 中有 全局components、全局指令、全局 filters
      // vm.constructor 上还存在一些其他全局 API，比如 component、directive、extend、filter、mixin、use、observable、set等
      // vm.constructor.prototype 构造函数的原型链上还存在很多方法，比如 $mount、$emit、$on、$watch 等
      console.log('vm.constructor', vm.constructor.directive)
      // 选项合并策略
      vm.$options = mergeOptions(
        // 解析出 Vue 构造函数上的 options
        resolveConstructorOptions(vm.constructor),
        // 自定义的 options
        options || {},
        vm
      )
    }

    // 设置代理
    vm._renderProxy = vm

    // expose real self
    vm._self = vm

    // 生命周期
    initLifecycle(vm)

    // 事件中心
    initEvents(vm)

    // render 函数
    initRender(vm)

    callHook(vm, 'beforeCreate')

    // resolve injections before data/props
    initInjections(vm)

    // 数据响应式处理
    initState(vm)

    // resolve provide after data/props
    initProvide(vm)

    callHook(vm, 'created')

    // 挂载 DOM
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

/**
 * 性能优化，
 * 将组件配置对象上的一些深层次属性放置在 vm.$options 中，以提高代码执行效率
 * @param {*} vm 组件实例
 * @param {*} options 配置项
 */
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  // 基于构造函数上的配置对象创建 vm.$options
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

/**
 * 解析 Vue 构造函数上的 options，并返回
 * @param {*} Ctor
 * @returns
 */
export function resolveConstructorOptions (Ctor: Class<Component>) {
  // 实例构造函数上的选项
  let options = Ctor.options

  if (Ctor.super) {
    // 有基类
    // 获取基类上的配置选项
    const superOptions = resolveConstructorOptions(Ctor.super)

    // 缓存
    const cachedSuperOptions = Ctor.superOptions

    // 缓存无效了
    if (superOptions !== cachedSuperOptions) {

      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions

      // 获取更改后的选型
      const modifiedOptions = resolveModifiedOptions(Ctor)

      if (modifiedOptions) {
        // 合并至 实例构造函数上的选项 的 extendOptions 属性中
        extend(Ctor.extendOptions, modifiedOptions)
      }

      // 再做一层覆盖合并
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)

      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
