/* @flow */

import { noop, extend } from 'shared/util'
import { warn as baseWarn, tip } from 'core/util/debug'

type CompiledFunctionResult = {
  render: Function;
  staticRenderFns: Array<Function>;
};

function createFunction (code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}

export function createCompileToFunctionFn (compile: Function): Function {
  // 编译缓存
  const cache: {
    [key: string]: CompiledFunctionResult;
  } = Object.create(null)

  // 这里是我们在 $mount 中调用的实际地方
  return function compileToFunctions (
    template: string, // 模版内容
    options?: CompilerOptions, // 编译选项
    vm?: Component // 实例
  ): CompiledFunctionResult {
    options = extend({}, options)
    const warn = options.warn || baseWarn
    delete options.warn

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      // 检测可能的 CSP 限制
      try {
        new Function('return 1')
      } catch (e) {
        // CSP 限制，建议使用 render 函数
      }
    }

    // 如果有缓存，则跳过编译，直接从缓存中获取上次编译的结果
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    if (cache[key]) {
      return cache[key]
    }

    // 开始编译模版
    const compiled = compile(template, options)

    // 检查编译期间产生的 error 和 tip，分别输出到控制台

    // 转换编译得到的字符串代码为函数，通过 new Function(code) 实现（createFunction的效果就是new Function）

    console.log('compiled.render', compiled.render)
    // with(this){return _c('div',[_c('p',[_v("Hello hello hello")]),_v(" "),_c('input',{directives:[{name:"focus",rawName:"v-focus"}]}),_v(" "),_c('p',[_v(_s(msg))])])}
    const res = {}
    const fnGenErrors = []
    console.log('生成后的', createFunction(compiled.render, fnGenErrors))
    res.render = createFunction(compiled.render, fnGenErrors)
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // 缓存
    return (cache[key] = res)
  }
}
