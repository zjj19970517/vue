/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * 订阅发布模式
 * 用于收集依赖
 * 以及依赖更新的通知和触发
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>; // 使用数组，存放所有的订阅（或依赖）

  constructor () {
    this.id = uid++
    this.subs = [];
  }

  // 添加订阅（也就是依赖）
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  // 移除某个订阅
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  // 添加依赖
  depend () {
    // Dep.target 是一个全局的属性
    // 用来表示当前处理的 Watcher 的上下文
    if (Dep.target) {
      // 这里调的是 Watcher 里的 addDep 方法
      // 传入当前 Dep 实例，最终也会往这实例上增加内容
      Dep.target.addDep(this)
    }
  }

  // 发布通知
  notify () {
    // 获取所有的订阅
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // FIXME: config.async 已经被废弃了，默认值为 true，那排序干嘛呢？为什么只在测试环境进行排序呢？
      // 对订阅做排序
      // 按订阅收集的先后来排序
      subs.sort((a, b) => a.id - b.id)
    }
    // 遍历所有的订阅，然后触发通知
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null
const targetStack = []

export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
