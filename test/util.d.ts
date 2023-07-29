declare const assertType: <T>() => <U extends T>(
  result: [T] extends [U] ? U : never,
) => void
