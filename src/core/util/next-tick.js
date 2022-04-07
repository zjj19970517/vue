/* @flow */
/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

export let isUsingMicroTask = false

const callbacks = []
let pending = false

// 刷新 callbacks 中的函数
function flushCallbacks () {
  debugger
  pending = false // 设置为 false，表示下一个 flushCallbacks 函数可以进入浏览器的任务队列了
  const copies = callbacks.slice(0) // 浅拷贝
  console.log('这一次', copies);
  callbacks.length = 0 // 清空
  // 遍历 callbacks 执行回调函数
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// Here we have async deferring wrappers using microtasks.
// In 2.5 we used (macro) tasks (in combination with microtasks).
// However, it has subtle problems when state is changed right before repaint
// (e.g. #6813, out-in transitions).
// Also, using (macro) tasks in event handler would cause some weird behaviors
// that cannot be circumvented (e.g. #7109, #7153, #7546, #7834, #8109).
// So we now use microtasks everywhere, again.
// A major drawback of this tradeoff is that there are some scenarios
// where microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690, which have workarounds)
// or even between bubbling of the same event (#6566).

// The nextTick behavior leverages the microtask queue, which can be accessed
// via either native Promise.then or MutationObserver.
// MutationObserver has wider support, however it is seriously bugged in
// UIWebView in iOS >= 9.3.3 when triggered in touch event handlers. It
// completely stops working after triggering a few times... so, if native
// Promise is available, we will use it:
/* istanbul ignore next, $flow-disable-line */


let timerFunc

// 支持 Promise，并且 Promise 的实现是语法本身实现的，而不是使用 JS 手写的
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  // 将 flushCallbacks 放入微任务回调队列中
  timerFunc = () => {
    p.then(flushCallbacks)
    // In problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    // 这里是处理 UIWebViews 兼容问题的
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true // 使用了微任务
} else if (!isIE && typeof MutationObserver !== 'undefined' && (
  isNative(MutationObserver) ||
  // PhantomJS and iOS 7.x
  MutationObserver.toString() === '[object MutationObserverConstructor]'
  )) {
  // 如果原生不支持 Promise，使用 MutationObserver 替代
  // MutationObserver 的回调，也会进入浏览器的微任务队列
  // IE 不支持这个
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true
  })
  timerFunc = () => {
    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
  isUsingMicroTask = true
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  // 下一步为使用 setImmediate
  timerFunc = () => {
    setImmediate(flushCallbacks)
  }
  // 此时会将 flushCallbacks 放入宏任务队列
} else {
  // 最终的保底方案为走 setTimeout
  // 也是将 flushCallbacks 放入宏任务队列
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

/**
 *
 * @param {*} cb 回调函数
 * @param {*} ctx 上下文
 * @returns
 */
export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve

  // callbacks 是全局的回调函数集
  // 对 cb 函数封装一层，并进行了 try catch
  // 之所以 try catch 是因为 nextTick 有时候会接收用户侧提供的函数
  callbacks.push(() => {
    // 通常情况下都是有回调函数的，我们先不考虑无 cb 的情况
    if (cb) {
      try {
        // 执行回调函数
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  // 如果 pending 为 false，表示现在浏览器的任务队列中没有 flushCallbacks 函数
  // 如果 pending 为 true，则表示浏览器的任务队列中已经被放入了 flushCallbacks 函数，
  // 待执行 flushCallbacks 函数时，pending 会被再次置为 false，表示下一个 flushCallbacks 函数可以进入
  // 浏览器的任务队列了
  // pending 的作用：保证在同一时刻，浏览器的任务队列中只有一个 flushCallbacks 函数
  if (!pending) {
    pending = true
    timerFunc()
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
