// /arab-cinema/tn: Tunisia has its own cinema page. A route of its own (a static segment wins over
// [country]), so the answer is a real permanent redirect, not a page streamed with a 200.
export function GET(request: Request) {
  return Response.redirect(new URL('/tunisian/cinema', request.url), 308)
}

export const HEAD = GET
