import { supabase } from "./supabaseClient.js";

// Batas jumlah baris yang diambil sekaligus -- cukup besar untuk pemakaian
// pribadi normal. Kalau suatu saat riwayatnya jadi sangat panjang (ribuan
// baris/tahun), ini bisa diubah jadi query berpaginasi per bulan.
const FETCH_LIMIT = 500;

export async function fetchExpenses() {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);

  if (error) throw error;
  return data || [];
}

export async function createExpense(userId, payload) {
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
      expense_date: payload.expenseDate,
      amount: payload.amount,
      category: payload.category,
      note: payload.note || null,
      receipt_url: payload.receiptUrl || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateExpense(id, payload) {
  const { data, error } = await supabase
    .from("expenses")
    .update({
      expense_date: payload.expenseDate,
      amount: payload.amount,
      category: payload.category,
      note: payload.note || null,
      receipt_url: payload.receiptUrl || null
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExpense(id) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchCustomCategories() {
  const { data, error } = await supabase
    .from("custom_categories")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addCustomCategory(userId, name) {
  const { data, error } = await supabase
    .from("custom_categories")
    .insert({ user_id: userId, name })
    .select()
    .single();

  if (error) throw error;
  return data;
}
