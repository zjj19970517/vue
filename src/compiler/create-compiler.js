/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

export function createCompilerCreator (baseCompile: Function): Function {
  return function createCompiler (baseOptions: CompilerOptions) {
    // 真正的编译函数
    function compile (
      template: string, // 待编译模版
      options?: CompilerOptions // 编译配置选项
    ): CompiledResult {
      // 拷贝一份
      const finalOptions = Object.create(baseOptions)
      // 收集错误
      const errors = []
      // 存储提示
      const tips = []
      // 定义警告函数
      finalOptions.warn = (msg, tip) => {
        (tip ? tips : errors).push(msg)
      }

      // debugger

      // 配置扩展
      if (options) {
        // merge custom modules
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives),
            options.directives
          )
        }
        // copy other options
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      // 执行真正的编译逻辑
      const compiled = baseCompile(template, finalOptions)
      compiled.errors = errors // 编译中的错误
      compiled.tips = tips // 编译后的信息
      return compiled // 返回编译结果
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
