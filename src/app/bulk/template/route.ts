/** CSV template download — same columns the bulk parser accepts (name, number, message). */
export async function GET() {
  const csv =
    "name,number,message\n" +
    "Juan,09171234567,Hello Juan, your order is ready for pickup.\n" +
    "Maria,09981234567,Hello Maria, your order is ready for pickup.\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="smmsoft-bulk-template.csv"',
    },
  });
}
