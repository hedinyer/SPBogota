// ponytail: probe CDP de Chrome/Cursor; el 404 page era ~169ms por request
export function GET() {
  return new Response(null, { status: 404 });
}
