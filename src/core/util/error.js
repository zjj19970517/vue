/* @flow */

import config from '../config'
import { warn } from './debug'
import { inBrowser, inWeex } from './env'
import { isPromise } from 'shared/util'
import { pushTarget, popTarget } from '../observer/dep'

export function handleError (err: Error, vm: any, info: string) {
  pushTarget()
  try {
    if (vm) {
      let cur = vm
      // 首先获取到报错的组件，之后递归查找当前组件的父组件，依次调用errorCaptured 方法。
      // 在遍历调用完所有 errorCaptured 方法、或 errorCaptured 方法有报错时，调用 globalHandleError 方法
      while ((cur = cur.$parent)) {
        const hooks = cur.$options.errorCaptured
        // 判断是否存在 errorCaptured 钩子函数
        if (hooks) {
          for (let i = 0; i < hooks.length; i++) {
            try {
              // 执行 errorCaptured 钩子函数
              // capture 表示，errorCaptured 执行结果是否为false
              const capture = hooks[i].call(cur, err, vm, info) === false
              // 如果返回 false 不会继续触发全局的 globalHandleError
              if (capture) return
            } catch (e) {
              globalHandleError(e, cur, 'errorCaptured hook')
            }
          }
        }
      }
    }
    globalHandleError(err, vm, info)
  } finally {
    popTarget()
  }
}

export function invokeWithErrorHandling (
  handler: Function, // 回调函数
  context: any, // 上下文
  args: null | any[], // 参数
  vm: any, // 实例
  info: string // 异常提示的消息内容
) {
  let res
  // 外部进行异常捕获
  try {
    // 执行 handler 并传入参数
    res = args ? handler.apply(context, args) : handler.call(context)
    // res 为返回值
    // 如果 res 为 Promise，非 Vue 实例，返回值未处理过
    if (res && !res._isVue && isPromise(res) && !res._handled) {
      // 捕获 Promise 的异常
      // 捕获到异常后，统一执行 handleError
      res.catch(e => handleError(e, vm, info + ` (Promise/async)`))
      res._handled = true
    }
  } catch (e) {
    handleError(e, vm, info)
  }
  return res
}

function globalHandleError (err, vm, info) {
  if (config.errorHandler) {
    try {
      return config.errorHandler.call(null, err, vm, info)
    } catch (e) {
      // if the user intentionally throws the original error in the handler,
      // do not log it twice
      if (e !== err) {
        logError(e, null, 'config.errorHandler')
      }
    }
  }
  logError(err, vm, info)
}

function logError (err, vm, info) {
  if (process.env.NODE_ENV !== 'production') {
    warn(`Error in ${info}: "${err.toString()}"`, vm)
  }
  /* istanbul ignore else */
  if ((inBrowser || inWeex) && typeof console !== 'undefined') {
    console.error(err)
  } else {
    throw err
  }
}
