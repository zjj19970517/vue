import Vue from './instance/index' // 引入了 Vue 构造函数，同时也在 Vue 的原型上增加了属性和方法
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'

// 初始化全局API
// 也就是 Vue 构造函数的静态属性和方法
initGlobalAPI(Vue)

// 当前 Vue 实例是否运行于服务器。
Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

// SSR 上下文
Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// expose FunctionalRenderContext for ssr runtime helper installation
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

Vue.version = '__VERSION__'

export default Vue
