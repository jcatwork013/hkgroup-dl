"use client";

import { useEffect, useState } from "react";

// Giỏ hàng lưu localStorage. Đủ nhẹ, không cần backend cho tới bước thanh toán.
export type CartItem = {
  id: string;
  slug: string;
  name: string;
  price_vnd: number;
  image?: string;
  qty: number;
};

const KEY = "hk_cart";
const REF_KEY = "hk_ref";
type Listener = () => void;
const listeners = new Set<Listener>();

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]") as CartItem[];
  } catch {
    return [];
  }
}

function write(items: CartItem[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((l) => l());
}

export function getCart(): CartItem[] {
  return read();
}
export function cartCount(): number {
  return read().reduce((a, i) => a + i.qty, 0);
}
export function cartTotal(): number {
  return read().reduce((a, i) => a + i.qty * i.price_vnd, 0);
}
export function addToCart(item: Omit<CartItem, "qty">, qty = 1): void {
  const items = read();
  const e = items.find((i) => i.id === item.id);
  if (e) e.qty += qty;
  else items.push({ ...item, qty });
  write(items);
}
export function setQty(id: string, qty: number): void {
  let items = read();
  if (qty <= 0) items = items.filter((i) => i.id !== id);
  else {
    const e = items.find((i) => i.id === id);
    if (e) e.qty = qty;
  }
  write(items);
}
export function removeItem(id: string): void {
  write(read().filter((i) => i.id !== id));
}
export function clearCart(): void {
  write([]);
}
export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

// Mã giới thiệu affiliate (?ref=CODE) — lưu để gán hoa hồng lúc thanh toán.
export function captureRef(): void {
  if (typeof window === "undefined") return;
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (ref) window.localStorage.setItem(REF_KEY, ref.trim());
}
export function getRef(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(REF_KEY) || "";
}

// Hook: theo dõi giỏ hàng (đếm + danh sách) reactively.
export function useCart(): { items: CartItem[]; count: number; total: number } {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    return subscribe(sync);
  }, []);
  return {
    items,
    count: items.reduce((a, i) => a + i.qty, 0),
    total: items.reduce((a, i) => a + i.qty * i.price_vnd, 0),
  };
}
