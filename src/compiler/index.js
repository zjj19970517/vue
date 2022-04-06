/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.

/**
 * 创建出编译器
 * createCompiler 得到的结果是一个函数
 */
export const createCompiler = createCompilerCreator(
// 初始化编译执行函数
function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 解析模版内容为 AST 抽象语法树
  const ast = parse(template.trim(), options)
  console.log('解析的AST', ast)
  // 优化
  optimize(ast, options)
  // 生成最终的代码
  const code = generate(ast, options)

  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})

// 这部分代码是在Vue引入阶段定义的，createCompilerCreator在传递了一个baseCompile函数作为参数后，返回了一个编译器的生成器，
// 也就是createCompiler,有了这个生成器，当将编译配置选项baseOptions传入后,这个编译器生成器便生成了一个指定环境指定配置下的编译器，
// 而其中编译执行函数就是返回对象的compileToFunctions。
