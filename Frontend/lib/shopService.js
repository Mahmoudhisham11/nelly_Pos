// shopService.js — Shop Service Layer Connected to FastAPI & Unified SQLite
import { api, unwrap } from "./apiClient";
import { roundCurrency } from "./utils";

function normalizeShopProduct(p) {
  if (!p) return p;
  const cost = Number(p.costPrice !== undefined ? p.costPrice : (p.wholesalePrice || p.cost_price || p.default_cost_price || 0));
  const wholesale = Number(p.wholesalePrice !== undefined ? p.wholesalePrice : (p.costPrice || p.wholesale_price || cost || 0));
  const selling = Number(p.sellingPrice !== undefined ? p.sellingPrice : (p.price || p.retail_price || 0));
  const qty = Number(p.quantity !== undefined ? p.quantity : (p.stock || 0));

  return {
    ...p,
    id: p.id,
    local_id: p.id,
    productId: p.id,
    name: p.name,
    barcode: p.barcode || "",
    category: p.category || "أخرى",
    brand: p.brand || "Nelly",
    quantity: qty,
    stock: qty,
    costPrice: cost,
    cost_price: cost,
    default_cost_price: cost,
    wholesalePrice: wholesale,
    wholesale_price: wholesale,
    sellingPrice: selling,
    selling_price: selling,
    price: selling,
    retail_price: selling,
    minThreshold: Number(p.minThreshold || p.min_threshold || 3),
    description: p.description || "",
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function subscribeToShopProducts(onData, onError) {
  return api.subscribe(
    async () => {
      const list = await api.get("/shop/products?limit=5000");
      return Array.isArray(list) ? list.map(normalizeShopProduct) : [];
    },
    onData,
    onError
  );
}

export async function addShopProduct(product) {
  const payload = {
    name: (product.name || "").trim(),
    barcode: (product.barcode || "").trim(),
    category: product.category || "أخرى",
    brand: product.brand || "Nelly",
    quantity: Number(product.quantity || product.stock || 0),
    costPrice: Number(product.costPrice || product.wholesalePrice || 0),
    wholesalePrice: Number(product.wholesalePrice || product.costPrice || 0),
    sellingPrice: Number(product.sellingPrice || product.price || product.retail_price || 0),
    minThreshold: Number(product.minThreshold || 3),
    description: product.description || "",
  };
  const res = unwrap(await api.post("/shop/products", payload));
  return normalizeShopProduct(res);
}

export async function updateShopProduct(id, updates) {
  const payload = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.barcode !== undefined) payload.barcode = updates.barcode.trim();
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.brand !== undefined) payload.brand = updates.brand;
  if (updates.quantity !== undefined || updates.stock !== undefined) {
    payload.quantity = Number(updates.quantity !== undefined ? updates.quantity : updates.stock);
  }
  if (updates.costPrice !== undefined || updates.cost_price !== undefined) {
    payload.costPrice = Number(updates.costPrice !== undefined ? updates.costPrice : updates.cost_price);
  }
  if (updates.wholesalePrice !== undefined || updates.wholesale_price !== undefined) {
    payload.wholesalePrice = Number(updates.wholesalePrice !== undefined ? updates.wholesalePrice : updates.wholesale_price);
  }
  if (updates.sellingPrice !== undefined || updates.price !== undefined || updates.retail_price !== undefined) {
    payload.sellingPrice = Number(updates.sellingPrice !== undefined ? updates.sellingPrice : (updates.price ?? updates.retail_price));
  }
  if (payload.quantity !== undefined && updates.expectedQuantity !== undefined) {
    // the quantity the edit screen showed: the server refuses the change if the stock moved since then
    payload.expectedQuantity = Number(updates.expectedQuantity);
  }
  if (updates.reason !== undefined) payload.reason = updates.reason;
  if (updates.minThreshold !== undefined) payload.minThreshold = Number(updates.minThreshold);
  if (updates.description !== undefined) payload.description = updates.description;

  const res = unwrap(await api.put(`/shop/products/${id}`, payload));
  return normalizeShopProduct(res);
}

export async function deleteShopProduct(id) {
  return api.delete(`/shop/products/${id}`);
}

export async function transferFromWarehouseToShop(warehouseProduct, qtyToTransfer, user = null) {
  const qty = parseFloat(qtyToTransfer);
  if (isNaN(qty) || qty <= 0) {
    throw new Error("الكمية المحولة يجب أن تكون رقماً أكبر من صفر.");
  }

  return unwrap(await api.post("/shop/transfers", {
    productId: warehouseProduct.id,
    productName: warehouseProduct.name,
    barcode: warehouseProduct.barcode || "",
    quantity: qty,
    direction: "to_shop",
    notes: "",
    createdBy: user?.displayName || user?.name || "المسؤول",
  }));
}

export async function transferFromShopToWarehouse(shopProduct, qtyToTransfer, user = null) {
  const qty = parseFloat(qtyToTransfer);
  if (isNaN(qty) || qty <= 0) {
    throw new Error("الكمية المحولة يجب أن تكون رقماً أكبر من صفر.");
  }

  return unwrap(await api.post("/shop/transfers", {
    productId: shopProduct.id,
    productName: shopProduct.name,
    barcode: shopProduct.barcode || "",
    quantity: qty,
    direction: "to_warehouse",
    notes: "",
    createdBy: user?.displayName || user?.name || "المسؤول",
  }));
}
