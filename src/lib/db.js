// Guards against "silent RLS": a blocked update/delete returns error=null and data=[].
// Always chain .select(key) and verify at least one row was affected.
export async function mutate(query, { expectRows = true, key = 'id' } = {}) {
  const { data, error } = await query.select(key);
  if (error) throw error;
  if (expectRows && !data?.length) {
    throw new Error('Không có quyền thực hiện thao tác này hoặc dữ liệu không còn tồn tại.');
  }
  return data;
}
