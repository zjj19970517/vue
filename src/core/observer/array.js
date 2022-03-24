/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

// Array 的原型对象
const arrayProto = Array.prototype
// 基于 Array 原型对象 创建一个新的对象
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

// 处理 7 个会改变数组本身的原型方法
methodsToPatch.forEach(function (method) {
  // 缓存原始的方法
  const original = arrayProto[method]

  // arrayMethods 上 代理 method，进行重新定义
  def(arrayMethods, method, function mutator (...args) {
    // 调用缓存的原始方法进行求值
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted // 表示新插入的值
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 如果存在新插入的值，需要将插入的新值进行响应式化处理
    if (inserted) ob.observeArray(inserted)

    // 派发通知
    ob.dep.notify()
    return result
  })
})
