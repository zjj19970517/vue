import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'

// Vue 构造函数
function Vue (options) {
  // 这个方法就是 Vue.prototype._init 方法
  this._init(options)
}

// FIXME: 以下的几个方法，定义了 Vue 原型上的诸多方法和属性

// 定义 原型上的_init方法
// Vue.prototype._init
initMixin(Vue)

// 定义 原型上跟数据相关的属性和方法
// Vue.prototype.$data
// Vue.prototype.$props
// Vue.prototype.$set
// Vue.prototype.$delete
// Vue.prototype.$watch
stateMixin(Vue)

// 定义 原型上跟事件相关的属性和方法
// Vue.prototype.$on
// Vue.prototype.$once
// Vue.prototype.$off
// Vue.prototype.$emit
eventsMixin(Vue)

// 定义 原型上跟生命周期相关的方法
// Vue.prototype._update
// Vue.prototype.$forceUpdate
// Vue.prototype.$destroy
lifecycleMixin(Vue)

// 定义渲染相关的方法
// Vue.prototype.$nextTick
// Vue.prototype._render
renderMixin(Vue)

export default Vue
