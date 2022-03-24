/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}

  // Vue 默认的配置
  configDef.get = () => config

  // Vue.config 指向默认全局配置
  Object.defineProperty(Vue, 'config', configDef)

  // 暴露出一些 utils 方法
  // 不推荐使用它们
  // Vue.util.defineReactive(this.array, 1, DEFAULT_VALUE) 可以让数组某个值变为响应式的
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // Vue.set = Vue.prototype.$set
  Vue.set = set
  // Vue.delete = Vue.prototype.$delete
  Vue.delete = del
  // Vue.nextTick = Vue.prototype.$nextTick
  Vue.nextTick = nextTick

  // 响应式 API
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }

  // 初始化 'components', 'directives', 'filters'
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // _base 表示基类
  Vue.options._base = Vue

  // components 添加 keep-alive
  extend(Vue.options.components, builtInComponents)

  // Vue.use
  initUse(Vue)
  // Vue.mixin
  initMixin(Vue)
  // Vue.extend
  initExtend(Vue)
  // Vue.components, Vue.directive, Vue.filter
  initAssetRegisters(Vue)
}
