// Stand-in for 'next/cache' in unit tests: no data cache, so cached functions simply run, and
// revalidation does nothing.
export const unstable_cache = (fn) => fn
export const unstable_noStore = () => {}
export const revalidatePath = () => {}
export const revalidateTag = () => {}
