// Reading a model's JSON answer. Structured outputs sometimes come back with keys repeated after
// the real ones ({"genres":[…], …, "genres":[]}): JSON.parse keeps the last value and would wipe
// the answer. This reader keeps the FIRST value of a repeated key and stops after the first
// complete value (trailing text is ignored). Small and strict otherwise; throws on bad JSON.

export function parseFirstJson(text: string): unknown {
  let i = 0
  const fail = (): never => { throw new SyntaxError(`Bad JSON at ${i}`) }
  const space = () => { while (i < text.length && /\s/.test(text[i])) i++ }

  function string(): string {
    if (text[i] !== '"') fail()
    i++
    let out = ''
    while (i < text.length) {
      const c = text[i++]
      if (c === '"') return out
      if (c === '\\') {
        const e = text[i++]
        if (e === 'u') {
          const hex = text.slice(i, i + 4)
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail()
          out += String.fromCharCode(parseInt(hex, 16))
          i += 4
        } else {
          const map: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }
          if (!(e in map)) fail()
          out += map[e]
        }
      } else {
        out += c
      }
    }
    return fail()
  }

  function value(depth: number): unknown {
    if (depth > 20) fail()
    space()
    const c = text[i]
    if (c === '{') {
      i++
      const out: Record<string, unknown> = {}
      space()
      if (text[i] === '}') { i++; return out }
      for (;;) {
        space()
        const key = string()
        space()
        if (text[i++] !== ':') fail()
        const item = value(depth + 1)
        if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = item
        space()
        if (text[i] === ',') { i++; continue }
        if (text[i] === '}') { i++; return out }
        fail()
      }
    }
    if (c === '[') {
      i++
      const out: unknown[] = []
      space()
      if (text[i] === ']') { i++; return out }
      for (;;) {
        out.push(value(depth + 1))
        space()
        if (text[i] === ',') { i++; continue }
        if (text[i] === ']') { i++; return out }
        fail()
      }
    }
    if (c === '"') return string()
    const literal = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i, i + 40))
    if (!literal) fail()
    i += literal[0].length
    return literal[0] === 'true' ? true : literal[0] === 'false' ? false : literal[0] === 'null' ? null : Number(literal[0])
  }

  // Some models wrap the JSON in prose or a code fence: start at the first brace.
  const start = text.indexOf('{')
  if (start < 0) fail()
  i = start
  return value(0)
}
