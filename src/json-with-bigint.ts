/**
 * MIT License
 *
 * Copyright (c) 2023 Ivan Korolenko
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

type JsonArray = Array<Json>

export type Json =
  | null
  | undefined
  | string
  | number
  | bigint
  | boolean
  | JsonObject
  | Record<string, unknown>
  | JsonArray

interface JsonObject {
  [x: string]: Json
}

/* 
  Function to serialize data to JSON string
  Converts BigInt values to custom format (strings with digits and "n" at the end) and then converts them to proper big integers in JSON string
*/
export const JSONStringify = (data: Json): string => {
  const bigInts = /([\[:])?"(\d+)n"([,\}\]])/g
  const preliminaryJSON = JSON.stringify(data, (_, value) =>
    typeof value === 'bigint' ? value.toString() + 'n' : value,
  )
  const finalJSON = preliminaryJSON.replace(bigInts, '$1$2$3')

  return finalJSON
}

/* 
  Function to parse JSON
  If JSON has values presented in a lib's custom format (strings with digits and "n" character at the end), we just parse them to BigInt values (for backward compatibility with previous versions of the lib)
  If JSON has values greater than Number.MAX_SAFE_INTEGER, we convert those values to our custom format, then parse them to BigInt values.
  Other types of values are not affected and parsed as native JSON.parse() would parse them.

  Big numbers are found and marked using RegEx with these conditions:
    - Before the match there's : OR :[ OR :[anyNumberOf(anyCharacters)
    - The match itself has more than 16 digits OR (16 digits and any digit of the number is greater than that of the Number.MAX_SAFE_INTEGER)
    - After the match there's , OR } OR ]
*/
export function JSONParse<T extends Json = Json>(json: string): T {
  const numbersBiggerThanMaxInt =
    /(?<=:|:\[|:\[.*)(\d{17,}|(?:[9](?:[1-9]07199254740991|0[1-9]7199254740991|00[8-9]199254740991|007[2-9]99254740991|007199[3-9]54740991|0071992[6-9]4740991|00719925[5-9]740991|007199254[8-9]40991|0071992547[5-9]0991|00719925474[1-9]991|00719925474099[2-9])))(?=[,\}\]])/g
  const serializedData = json.replace(numbersBiggerThanMaxInt, '"$1n"')

  return JSON.parse(serializedData, (_, value) => {
    const isCustomFormatBigInt =
      typeof value === 'string' && value.match(/^\d+n$/)

    if (isCustomFormatBigInt)
      return BigInt(value.substring(0, value.length - 1))

    return value
  })
}
