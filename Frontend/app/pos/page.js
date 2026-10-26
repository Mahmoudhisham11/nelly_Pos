"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import POSReceiptModal from "@/components/POSReceiptModal";
import POSHeldInvoicesModal from "@/components/pos/POSHeldInvoicesModal";
import POSNewCustomerModal from "@/components/pos/POSNewCustomerModal";
import POSCloseShiftModal from "@/components/pos/POSCloseShiftModal";
import POSReturnModal from "@/components/pos/POSReturnModal";
import POSInvoiceDetailsModal from "@/components/pos/POSInvoiceDetailsModal";
import POSShiftInvoices from "@/components/pos/POSShiftInvoices";
import { subscribeToShopProducts } from "@/lib/shopService";
import { subscribeToCustomers, addCustomer } from "@/lib/customersService";
import { subscribeToEmployees } from "@/lib/employeesService";
import {
  subscribeToSales,
  createSaleInvoice,
  closeShiftAndMoveToReports,
  returnSaleItemOrInvoice
} from "@/lib/salesService";
import { formatNumber, roundCurrency } from "@/lib/utils";
import confetti from "canvas-confetti";
import {
  ShoppingCart,
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Clock,
  User,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Receipt,
  PauseCircle,
  FolderClock,
  Lock,
  TrendingUp,
  DollarSign,
  Coins,
  Users,
  X,
  Package
} from "lucide-react";
import { searchProducts, findExactProduct } from "@/lib/productSearch";
import styles from "./pos.module.css";

export default function POSPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  // Data states
  const [shopProducts, setShopProducts] = useState([]);
  const [currentShiftSales, setCurrentShiftSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedSellerEmployee, setSelectedSellerEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  // Search & Cart states
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(0);
  const [cart, setCart] = useState([]);
  const [cartInitialized, setCartInitialized] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [discountType, setDiscountType] = useState("fixed"); // "fixed" | "percent"
  const [discountValue, setDiscountValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("نقدي");
  const [receivedCash, setReceivedCash] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  // Suspended Invoices (الفواتير المعلقة)
  const [heldInvoices, setHeldInvoices] = useState([]);
  const [isHeldInvoicesModalOpen, setIsHeldInvoicesModalOpen] = useState(false);

  // Modals & Feedback
  const [completedInvoice, setCompletedInvoice] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCheckoutDrawerOpen, setIsCheckoutDrawerOpen] = useState(false);

  // Shift Invoices Table State & Filters
  const [showShiftInvoices, setShowShiftInvoices] = useState(false);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState(null);

  // Return Modal State
  const [itemToReturn, setItemToReturn] = useState(null);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState("طلب العميل");
  const [isReturning, setIsReturning] = useState(false);

  // Close Shift Modal State
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [shiftNotes, setShiftNotes] = useState("");
  const [isClosingShift, setIsClosingShift] = useState(false);

  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Load suspended invoices from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nelly_held_invoices");
      if (saved) {
        setHeldInvoices(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Error reading held invoices:", e);
    }
  }, []);

  const saveHeldInvoicesToStorage = (list) => {
    setHeldInvoices(list);
    try {
      localStorage.setItem("nelly_held_invoices", JSON.stringify(list));
    } catch (e) {
      console.error("Error saving held invoices:", e);
    }
  };

  // Load active POS cart from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nelly_active_pos_cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        } else if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.cart)) setCart(parsed.cart);
          if (parsed.selectedCustomer) setSelectedCustomer(parsed.selectedCustomer);
          if (parsed.selectedSellerEmployee) setSelectedSellerEmployee(parsed.selectedSellerEmployee);
          if (parsed.discountType) setDiscountType(parsed.discountType);
          if (parsed.discountValue !== undefined) setDiscountValue(parsed.discountValue);
          if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod);
          if (parsed.receivedCash !== undefined) setReceivedCash(parsed.receivedCash);
          if (parsed.orderNotes !== undefined) setOrderNotes(parsed.orderNotes);
        }
      }
    } catch (e) {
      console.error("Error loading active cart:", e);
    } finally {
      setCartInitialized(true);
    }
  }, []);

  // Persist active POS cart to localStorage whenever it or related fields change
  useEffect(() => {
    if (!cartInitialized) return;

    try {
      if (cart.length === 0 && !selectedCustomer && !selectedSellerEmployee && !discountValue && !orderNotes && !receivedCash) {
        localStorage.removeItem("nelly_active_pos_cart");
      } else {
        const payload = {
          cart,
          selectedCustomer,
          selectedSellerEmployee,
          discountType,
          discountValue,
          paymentMethod,
          receivedCash,
          orderNotes
        };
        localStorage.setItem("nelly_active_pos_cart", JSON.stringify(payload));
      }
    } catch (e) {
      console.error("Error saving active cart:", e);
    }
  }, [cart, selectedCustomer, selectedSellerEmployee, discountType, discountValue, paymentMethod, receivedCash, orderNotes, cartInitialized]);

  // Sync stock of items in cart when live shopProducts update
  useEffect(() => {
    if (!cartInitialized || shopProducts.length === 0 || cart.length === 0) return;

    setCart(prevCart => {
      let changed = false;
      const updated = prevCart.map(item => {
        const live = shopProducts.find(p => p.id === (item.productId || item.id));
        if (live && live.quantity !== undefined && live.quantity !== item.stock) {
          changed = true;
          return { ...item, stock: Number(live.quantity ?? 0) };
        }
        return item;
      });
      return changed ? updated : prevCart;
    });
  }, [shopProducts, cartInitialized]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target)
      ) {
        setSearchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Real-time Subscriptions: Shop Products, Current Shift Sales, and Customers
  useEffect(() => {
    if (!user) return;

    let pLoaded = false;
    let sLoaded = false;
    let cLoaded = false;

    // Fast unlock fallback (500ms max)
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 500);

    const unsubShop = subscribeToShopProducts((data) => {
      setShopProducts(data || []);
      pLoaded = true;
      setLoading(false);
    });

    const unsubSales = subscribeToSales((data) => {
      setCurrentShiftSales(data || []);
      sLoaded = true;
      if (pLoaded || cLoaded) setLoading(false);
    });

    const unsubCust = subscribeToCustomers((data) => {
      setCustomers(data || []);
      cLoaded = true;
      if (pLoaded || sLoaded) setLoading(false);
    });

    const unsubEmp = subscribeToEmployees((data) => {
      setEmployees(data);
      if (data && data.length > 0) {
        setSelectedSellerEmployee(prev => {
          if (prev) return prev;
          if (data.length === 1) return data[0];
          if (user) {
            const matched = data.find(emp =>
              (emp.email && user.email && emp.email.toLowerCase() === user.email.toLowerCase()) ||
              (emp.name && user.displayName && emp.name.toLowerCase() === user.displayName.toLowerCase())
            );
            if (matched) return matched;
          }
          return null;
        });
      }
    });

    return () => {
      unsubShop();
      unsubSales();
      unsubCust();
      unsubEmp();
    };
  }, [user]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4500);
  };

  // Autocomplete products matching the search text in the shop: best matches first (exact barcode/code, then the rest)
  const matchingShopProducts = useMemo(() => searchProducts(shopProducts, searchTerm, { limit: 30 }), [searchTerm, shopProducts]);

  // Keep the highlighted result visible while moving with the arrow keys
  useEffect(() => {
    if (!searchDropdownOpen) return;
    dropdownRef.current?.querySelector(`[data-result-index="${searchHighlight}"]`)?.scrollIntoView({ block: "nearest" });
  }, [searchHighlight, searchDropdownOpen]);

  // Cart Management - Strictly blocks 0 quantity items
  const addToCart = (product) => {
    if (!product) return;
    const availableStock = Number(product.quantity ?? 0);
    if (isNaN(availableStock) || availableStock <= 0) {
      showToast(`عفواً، الصنف "${product.name || 'المحدد'}" غير متوفر (الكمية: 0) ولا يمكن إضافته للسلة.`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= availableStock) {
          showToast(`الكمية المتاحة في المحل (${availableStock}) تم وضعها بالكامل في السلة.`);
          return prev;
        }
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1, stock: availableStock } : item
        );
      } else {
        return [...prev, {
          id: product.id,
          productId: product.id,
          barcode: product.barcode || "",
          name: product.name,
          category: product.category || "عام",
          wholesalePrice: roundCurrency(product.wholesalePrice || 0),
          sellingPrice: roundCurrency(product.sellingPrice || 0),
          stock: availableStock,
          quantity: 1
        }];
      }
    });

    setSearchTerm("");
    setSearchDropdownOpen(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Search box keys: a scanner sends the exact barcode + Enter; typing uses the arrows to pick and Enter to add
  const handleSearchKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!matchingShopProducts.length) return;
      e.preventDefault();
      setSearchDropdownOpen(true);
      const last = matchingShopProducts.length - 1;
      setSearchHighlight((i) => (e.key === "ArrowDown" ? Math.min(i + 1, last) : Math.max(i - 1, 0)));
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!searchTerm.trim()) return;

    // Exact barcode or item code first (scanner)
    const target = findExactProduct(shopProducts, searchTerm) || matchingShopProducts[Math.min(searchHighlight, matchingShopProducts.length - 1)];
    if (!target) {
      showToast(`لا يوجد صنف في المحل يطابق "${searchTerm}".`);
      return;
    }
    if (Number(target.quantity ?? 0) <= 0) {
      showToast(`عفواً، الصنف "${target.name}" نفد رصيده من المحل (الكمية: 0).`);
      return;
    }
    addToCart(target);
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const nextQty = item.quantity + delta;
        if (nextQty <= 0) return null;
        if (Number(item.stock ?? 0) <= 0 || nextQty > item.stock) {
          showToast(`الرصيد المتوفر في المحل هو ${item.stock} فقط.`);
          return item;
        }
        return { ...item, quantity: nextQty };
      }
      return item;
    }).filter(Boolean));
  };

  const setDirectQuantity = (id, newQty) => {
    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty <= 0) return;

    setCart(prev => prev.map(item => {
      if (item.id === id) {
        if (Number(item.stock ?? 0) <= 0) {
          showToast(`عفواً، الصنف غير متوفر.`);
          return item;
        }
        if (qty > item.stock) {
          showToast(`الرصيد المتوفر في المحل هو ${item.stock} فقط.`);
          return { ...item, quantity: item.stock };
        }
        return { ...item, quantity: qty };
      }
      return item;
    }));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setSelectedSellerEmployee(null);
    setDiscountValue("");
    setReceivedCash("");
    setOrderNotes("");
    try {
      localStorage.removeItem("nelly_active_pos_cart");
    } catch (e) {
      console.error("Error removing active cart from localStorage:", e);
    }
  };

  // Calculations
  const cartSubtotal = useMemo(() => {
    return roundCurrency(cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0));
  }, [cart]);

  const cartTotalCost = useMemo(() => {
    return roundCurrency(cart.reduce((sum, item) => sum + (item.wholesalePrice * item.quantity), 0));
  }, [cart]);

  const calculatedDiscount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (val <= 0 || cartSubtotal <= 0) return 0;
    if (discountType === "percent") {
      return roundCurrency((cartSubtotal * Math.min(100, val)) / 100);
    }
    return roundCurrency(Math.min(cartSubtotal, val));
  }, [cartSubtotal, discountValue, discountType]);

  // Wholesale barrier check
  const isDiscountViolatingWholesale = useMemo(() => {
    if (calculatedDiscount <= 0 || cartTotalCost <= 0) return false;
    const finalPrice = cartSubtotal - calculatedDiscount;
    return finalPrice <= cartTotalCost;
  }, [cartSubtotal, calculatedDiscount, cartTotalCost]);

  const cartFinalTotal = useMemo(() => {
    return roundCurrency(Math.max(0, cartSubtotal - calculatedDiscount));
  }, [cartSubtotal, calculatedDiscount]);

  const parsedReceivedCash = parseFloat(receivedCash) || 0;

  // When customer pays more than total -> change to return (المتبقي للعميل)
  const changeForCustomer = parsedReceivedCash > cartFinalTotal
    ? roundCurrency(parsedReceivedCash - cartFinalTotal)
    : 0;

  // When customer pays less than total -> remaining balance needed (المتبقي على العميل)
  const remainingDue = cartFinalTotal > parsedReceivedCash && (parsedReceivedCash > 0 || paymentMethod === "آجل")
    ? roundCurrency(cartFinalTotal - parsedReceivedCash)
    : 0;

  // Suspended Invoices logic
  const handleHoldInvoice = () => {
    if (cart.length === 0) {
      showToast("لا توجد أصناف في السلة لتعليق الفاتورة!");
      return;
    }

    const heldItem = {
      id: `HOLD-${Date.now()}`,
      createdAt: new Date().toISOString(),
      cart,
      customer: selectedCustomer,
      sellerEmployee: selectedSellerEmployee,
      discountType,
      discountValue,
      paymentMethod,
      orderNotes,
      total: cartFinalTotal
    };

    const updated = [heldItem, ...heldInvoices];
    saveHeldInvoicesToStorage(updated);
    clearCart();
    showToast("تم تعليق الفاتورة بنجاح. يمكنك إتمام فاتورة أخرى الآن.");
  };

  const handleRestoreHeldInvoice = (heldItem) => {
    // Exclude any items that currently have 0 stock in the shop
    const validCart = (heldItem.cart || []).filter(item => {
      const liveProduct = shopProducts.find(p => p.id === (item.productId || item.id));
      if (liveProduct && Number(liveProduct.quantity ?? 0) <= 0) {
        return false;
      }
      return true;
    });

    if (validCart.length < (heldItem.cart || []).length) {
      showToast("تم استبعاد بعض الأصناف من الفاتورة المعلقة لنفاد رصيدها من المحل حالياً.");
    }

    setCart(validCart);
    setSelectedCustomer(heldItem.customer || null);
    setSelectedSellerEmployee(heldItem.sellerEmployee || null);
    setDiscountType(heldItem.discountType || "fixed");
    setDiscountValue(heldItem.discountValue || "");
    setPaymentMethod(heldItem.paymentMethod || "نقدي");
    setOrderNotes(heldItem.orderNotes || "");
    setIsHeldInvoicesModalOpen(false);

    const filtered = heldInvoices.filter(h => h.id !== heldItem.id);
    saveHeldInvoicesToStorage(filtered);
    showToast("تمت استعادة الفاتورة المعلقة بنجاح.");
  };

  const handleDeleteHeldInvoice = (id, e) => {
    e.stopPropagation();
    const filtered = heldInvoices.filter(h => h.id !== id);
    saveHeldInvoicesToStorage(filtered);
    showToast("تم حذف الفاتورة المعلقة.");
  };

  // Submit Sale Invoice
  // Guards against a double click / double F2 creating the same invoice twice before the UI re-renders.
  const checkoutLock = useRef(false);
  const handleCheckout = async () => {
    if (checkoutLock.current) return;
    if (cart.length === 0) {
      showToast("سلة المشتريات فارغة!");
      return;
    }

    if (isDiscountViolatingWholesale) {
      showToast(`ممنوع البيع: الخصم يخفض الإجمالي لسعر جملة البضاعة (${cartTotalCost} ج.م) أو أقل منه.`);
      return;
    }

    if (paymentMethod === "آجل" && !selectedCustomer) {
      showToast("في حالة البيع الآجل، يجب اختيار عميل لتسجيل المتبقي عليه.");
      return;
    }

    if (!selectedSellerEmployee) {
      showToast("يرجى اختيار البائعة / الموظف المسئول عن الفاتورة أولاً!");
      return;
    }

    checkoutLock.current = true;
    setIsSubmitting(true);
    try {
      const effectivePaidAmount = paymentMethod === "آجل"
        ? (parsedReceivedCash > 0 ? Math.min(parsedReceivedCash, cartFinalTotal) : 0)
        : cartFinalTotal;

      const salePayload = {
        items: cart,
        customer: selectedCustomer,
        sellerEmployee: selectedSellerEmployee,
        discount: calculatedDiscount,
        paymentMethod,
        paidAmount: effectivePaidAmount,
        cashier: user ? {
          uid: user.uid,
          name: user.displayName || user.email || "الكاشير",
          email: user.email,
          branch: user.branch || ""
        } : null,
        notes: orderNotes
      };

      const result = await createSaleInvoice(salePayload);
      const isOk = result && (result.success || result.id || result.invoiceNumber);
      if (isOk) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });
        const inv = result.invoice || result;
        setCompletedInvoice(inv);
        setIsReceiptModalOpen(true);
        clearCart();
        setIsCheckoutDrawerOpen(false);
        const invNum = result.invoiceNumber || inv.invoiceNumber || inv.invoice_number || "";
        showToast(`تم إصدار الفاتورة رقم (${invNum}) بنجاح!`);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      showToast(err.message || "حدث خطأ أثناء حفظ الفاتورة.");
    } finally {
      checkoutLock.current = false;
      setIsSubmitting(false);
    }
  };

  // Handle Close Shift
  const handleConfirmCloseShift = async (drawer = {}) => {
    setIsClosingShift(true);
    try {
      const cashierData = user ? {
        uid: user.uid,
        name: user.displayName || user.email || "كاشير المحل",
        email: user.email
      } : { name: "كاشير المحل" };

      const res = await closeShiftAndMoveToReports({
        cashier: cashierData,
        notes: shiftNotes,
        openingCash: drawer.openingCash || 0,
        closingCashActual: drawer.closingCashActual ?? null,
      });

      if (res.success) {
        setIsCloseShiftModalOpen(false);
        setShiftNotes("");
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 }
        });
        showToast(`تم تقفيل الوردية بنجاح بنتيجة (${res.invoicesCount} فاتورة بإجمالي ${formatNumber(res.totalSales)} ج.م) وأرشفتها في تقفيلة الأيام.`);
      }
    } catch (err) {
      console.error("Close shift error:", err);
      showToast(err.message || "حدث خطأ أثناء تقفيل الوردية.");
    } finally {
      setIsClosingShift(false);
    }
  };

  // Handle Return Item or Full Invoice
  const handleReturnItem = async (invoice, item) => {
    setItemToReturn({
      invoice,
      item
    });
    setReturnQuantity(1);
    setReturnReason("طلب العميل إرجاع الصنف");
  };

  const handleConfirmReturnItem = async () => {
    if (!itemToReturn) return;
    setIsReturning(true);
    try {
      const cashierData = user ? {
        uid: user.uid,
        name: user.displayName || user.email || "كاشير المحل"
      } : null;

      const returnPayload = {
        items: [{
          ...itemToReturn.item,
          productId: itemToReturn.item.productId || itemToReturn.item.product_id || itemToReturn.item.id,
          productName: itemToReturn.item.name || itemToReturn.item.productName || itemToReturn.item.product_name,
          quantity: returnQuantity,
          sellingPrice: itemToReturn.item.sellingPrice || itemToReturn.item.selling_price || 0,
        }],
        itemsToReturn: [{
          ...itemToReturn.item,
          quantity: returnQuantity
        }],
        original_sale_id: itemToReturn.invoice.id,
        invoiceId: itemToReturn.invoice.id,
        invoiceNumber: itemToReturn.invoice.invoiceNumber,
        reason: returnReason,
        returnReason: returnReason,
        cashier: cashierData
      };

      const res = await returnSaleItemOrInvoice(returnPayload);
      if (res && (res.success || res.id || res.returnNumber)) {
        showToast(`تم استرجاع الصنف وإعادته لرصيد المحل بنجاح (رقم المرتجع: ${res.returnNumber || ""}).`);
        const remainingItemsCount = (itemToReturn.invoice.items || []).length;
        if (remainingItemsCount <= 1) {
          setCurrentShiftSales(prev => prev.filter(inv =>
            inv.id !== itemToReturn.invoice.id &&
            inv.invoiceNumber !== itemToReturn.invoice.invoiceNumber &&
            inv.local_id !== itemToReturn.invoice.id
          ));
        }
        setItemToReturn(null);
        setSelectedInvoiceForDetails(null);
      }
    } catch (err) {
      console.error("Return item error:", err);
      showToast(err.message || "حدث خطأ أثناء إتمام المرتجع.");
    } finally {
      setIsReturning(false);
    }
  };

  const handleReturnFullInvoice = async (invoice) => {
    const isConfirmed = window.confirm(`هل أنت متأكد من رغبتك في إرجاع كامل الفاتورة (${invoice.invoiceNumber})؟\nسيتم استرجاع كافة الأصناف لرصيد المحل وحذف الفاتورة من مبيعات الوردية.`);
    if (!isConfirmed) return;

    setIsReturning(true);
    try {
      const cashierData = user ? {
        uid: user.uid,
        name: user.displayName || user.email || "كاشير المحل"
      } : null;

      const returnPayload = {
        items: (invoice.items || []).map(it => ({
          ...it,
          productId: it.productId || it.product_id || it.id,
          productName: it.name || it.productName || it.product_name,
          quantity: it.quantity,
          sellingPrice: it.sellingPrice || it.selling_price || 0,
        })),
        itemsToReturn: invoice.items,
        original_sale_id: invoice.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        reason: "مرتجع كامل الفاتورة",
        returnReason: "مرتجع كامل الفاتورة",
        cashier: cashierData
      };

      const res = await returnSaleItemOrInvoice(returnPayload);
      if (res && (res.success || res.id || res.returnNumber)) {
        showToast(`تم إرجاع كامل الفاتورة بنجاح وحذفها من الوردية وإعادة كافة الأصناف لرصيد المحل.`);
        setCurrentShiftSales(prev => prev.filter(inv =>
          inv.id !== invoice.id &&
          inv.invoiceNumber !== invoice.invoiceNumber &&
          inv.local_id !== invoice.id &&
          inv.local_id !== invoice.local_id
        ));
        setSelectedInvoiceForDetails(null);
      }
    } catch (err) {
      console.error("Return full invoice error:", err);
      showToast(err.message || "حدث خطأ أثناء إرجاع الفاتورة.");
    } finally {
      setIsReturning(false);
    }
  };

  // Add new Customer quick handler
  const handleAddNewCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;

    try {
      const res = await addCustomer({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        balance: 0
      });
      if (res.success) {
        const newCust = { id: res.id, name: newCustomerName.trim(), phone: newCustomerPhone.trim() };
        setSelectedCustomer(newCust);
        setIsNewCustomerModalOpen(false);
        setNewCustomerName("");
        setNewCustomerPhone("");
        showToast(`تمت إضافة العميل "${newCust.name}" وتحديده بنجاح.`);
      }
    } catch (err) {
      showToast("فشلت إضافة العميل، يرجى التحقق من صحة البيانات.");
    }
  };

  // Active shift sales (strictly excludes returned, cancelled, and soft-deleted invoices)
  const activeShiftSales = useMemo(() => {
    return currentShiftSales.filter(inv =>
      !inv.deleted_at &&
      inv.status !== "cancelled" &&
      inv.status !== "returned" &&
      inv.status !== "مرتجعة"
    );
  }, [currentShiftSales]);

  // Filtered shift sales
  const filteredShiftSales = useMemo(() => {
    return activeShiftSales.filter(inv => {
      const query = invoiceSearchQuery.trim().toLowerCase();
      const matchesSearch = !query ||
        (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(query)) ||
        (inv.customer?.name && inv.customer.name.toLowerCase().includes(query)) ||
        (inv.customer?.phone && inv.customer.phone.includes(query));

      const matchesPayment = paymentFilter === "all" || inv.paymentMethod === paymentFilter;

      return matchesSearch && matchesPayment;
    });
  }, [activeShiftSales, invoiceSearchQuery, paymentFilter]);

  // Current shift totals
  const shiftStats = useMemo(() => {
    let salesTotal = 0;
    let profitTotal = 0;
    let cashTotal = 0;

    activeShiftSales.forEach(inv => {
      salesTotal += (inv.total || 0);
      profitTotal += (inv.totalProfit || 0);
      if (inv.paymentMethod === "نقدي") {
        cashTotal += (inv.paidAmount || inv.total || 0);
      }
    });

    return {
      count: activeShiftSales.length,
      sales: roundCurrency(salesTotal),
      profit: roundCurrency(profitTotal),
      cash: roundCurrency(cashTotal)
    };
  }, [activeShiftSales]);

  // Keyboard Shortcuts: F2 / Ctrl+Enter (Checkout), F4 / Ctrl+K (Search), F9 (Hold), Esc (Close modals)
  // The listener is registered once and always calls the LATEST handler (keyRef), so a shortcut never checks out
  // with an old payment method, customer, notes or discount captured by a stale closure.
  const keyRef = useRef(null);
  useEffect(() => {
    keyRef.current = (e) => {
      // Escape: close open modals or dropdowns
      if (e.key === "Escape") {
        if (isReceiptModalOpen) setIsReceiptModalOpen(false);
        else if (isCloseShiftModalOpen) setIsCloseShiftModalOpen(false);
        else if (isHeldInvoicesModalOpen) setIsHeldInvoicesModalOpen(false);
        else if (isNewCustomerModalOpen) setIsNewCustomerModalOpen(false);
        else if (selectedInvoiceForDetails) setSelectedInvoiceForDetails(null);
        else if (itemToReturn) setItemToReturn(null);
        else if (isCheckoutDrawerOpen) setIsCheckoutDrawerOpen(false);
        else setSearchDropdownOpen(false);
        return;
      }

      // F4 or Ctrl+K: Focus search / barcode scanner
      if (e.key === "F4" || (e.ctrlKey && (e.key === "k" || e.key === "K"))) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // F9: Hold current cart invoice
      if (e.key === "F9") {
        e.preventDefault();
        if (cart.length > 0) {
          handleHoldInvoice();
        }
        return;
      }

      // F2 or Ctrl+Enter: Open Checkout Drawer or Submit if already open
      if (e.key === "F2" || (e.ctrlKey && e.key === "Enter")) {
        e.preventDefault();
        if (cart.length === 0) {
          showToast("سلة المشتريات فارغة!");
          return;
        }
        if (!isCheckoutDrawerOpen) {
          setIsCheckoutDrawerOpen(true);
        } else {
          if (!isSubmitting && !isDiscountViolatingWholesale) {
            handleCheckout();
          }
        }
      }
    };
  });
  useEffect(() => {
    const onKey = (e) => keyRef.current?.(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app-layout">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed-toast-notification">
          <Sparkles className="toast-icon" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="main-content">
        <Navbar
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          title="نقطة البيع (الكاشير)"
          actions={
            <div className={styles.topActionsWrap}>
              {/* Toggle Shift Invoices Button */}
              <button
                type="button"
                onClick={() => setShowShiftInvoices(!showShiftInvoices)}
                className={`${styles.navToggleInvoicesBtn} ${showShiftInvoices ? styles.navToggleInvoicesBtnActive : styles.navToggleInvoicesBtnInactive}`}
                title={showShiftInvoices ? "العودة لسلة البيع والكاشير" : "عرض فواتير الوردية الحالية"}
              >
                {showShiftInvoices ? (
                  <>
                    <ShoppingCart size={17} />
                    <span className={styles.btnLabel}>العودة للسلة</span>
                  </>
                ) : (
                  <>
                    <Receipt size={17} />
                    <span className={styles.btnLabel}>فواتير الوردية</span>
                    <span className={styles.badgeCount}>{shiftStats.count}</span>
                  </>
                )}
              </button>

              {/* Close Shift Action Button */}
              <button
                type="button"
                onClick={() => setIsCloseShiftModalOpen(true)}
                className={styles.navCloseShiftBtn}
                title="تقفيل الوردية وأرشفة الحسابات"
              >
                <Lock size={17} />
                <span className={styles.btnLabel}>تقفيل الوردية</span>
              </button>
            </div>
          }
        />

        <div className="page-body pos-page-wrapper">

          {/* =========================================================
              2. KPI METRIC BAR: 4 Sleek Horizontal Cards
              ========================================================= */}
          <div className="pos-metrics-row">
            <div className="pos-kpi-pill-card metric-sales">
              <div className="pos-kpi-text">
                <span className="pos-kpi-subtitle">إجمالي مبيعات الوردية</span>
                <div className="pos-kpi-big-num">
                  {formatNumber(shiftStats.sales)} <small>ج.م</small>
                </div>
              </div>
              <div className="pos-kpi-icon-square">
                <DollarSign size={22} />
              </div>
            </div>

            <div className="pos-kpi-pill-card metric-profit">
              <div className="pos-kpi-text">
                <span className="pos-kpi-subtitle">صافي أرباح الوردية</span>
                <div className="pos-kpi-big-num text-emerald-600">
                  +{formatNumber(shiftStats.profit)} <small>ج.م</small>
                </div>
              </div>
              <div className="pos-kpi-icon-square">
                <TrendingUp size={22} />
              </div>
            </div>

            <div className="pos-kpi-pill-card metric-cash">
              <div className="pos-kpi-text">
                <span className="pos-kpi-subtitle">النقدية بالدرج (الكاش)</span>
                <div className="pos-kpi-big-num text-purple-700">
                  {formatNumber(shiftStats.cash)} <small>ج.م</small>
                </div>
              </div>
              <div className="pos-kpi-icon-square">
                <Banknote size={22} />
              </div>
            </div>

            <div className="pos-kpi-pill-card metric-invoices">
              <div className="pos-kpi-text">
                <span className="pos-kpi-subtitle">عدد الفواتير الصادرة</span>
                <div className="pos-kpi-big-num text-amber-700">
                  {shiftStats.count} <small>فاتورة</small>
                </div>
              </div>
              <div className="pos-kpi-icon-square">
                <Receipt size={22} />
              </div>
            </div>
          </div>

          {/* =========================================================
              3. MAIN WORKSPACE: Full Width Cart OR Full Width Shift Invoices
              ========================================================= */}
          {!showShiftInvoices ? (
            /* -------------------------------------------------------
                FULL-WIDTH SHOPPING CART & REGISTER
                ------------------------------------------------------- */
            <div className="pos-register-container">

              {/* Barcode & Search Input (Full Width Prominent Top Bar) */}
              <div className="pos-scanner-container">
                <label className={`pos-scanner-label ${styles.scannerLabel}`}>
                  <Barcode size={19} color="var(--rose-600)" />
                  <span>إضافة منتج من المحل (امسح الباركود أو اكتب اسم الصنف)</span>
                </label>
                <div className="pos-scanner-input-wrap">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="امسح الباركود أو اكتب اسم الصنف للإضافة السريعة..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setSearchHighlight(0);
                      setSearchDropdownOpen(true);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    onFocus={() => {
                      if (searchTerm.trim()) setSearchDropdownOpen(true);
                    }}
                    className={`pos-scanner-input-field ${styles.scannerInput}`}
                  />
                  <Search size={20} className="pos-scanner-leading-icon" />

                  {/* Autocomplete Menu */}
                  {searchDropdownOpen && matchingShopProducts.length > 0 && (
                    <div ref={dropdownRef} className="pos-search-dropdown-menu">
                      {matchingShopProducts.map((p, index) => {
                        const stockCount = Number(p.quantity ?? 0);
                        const isOut = isNaN(stockCount) || stockCount <= 0;
                        return (
                          <div
                            key={p.id}
                            data-result-index={index}
                            onMouseEnter={() => setSearchHighlight(index)}
                            style={index === searchHighlight ? { background: "var(--bg-card-hover)" } : undefined}
                            onClick={() => {
                              if (isOut) {
                                showToast(`عفواً، الصنف "${p.name}" نفد رصيده من المحل (الكمية: 0).`);
                                return;
                              }
                              addToCart(p);
                            }}
                            className={`pos-search-result-item ${isOut ? styles.outOfStockItem : ""}`}
                          >
                            <div>
                              <div className={`pos-result-name ${isOut ? styles.outOfStockText : ""}`}>
                                {p.name} {isOut && <span className={styles.outOfStockBadge}>(نفد ❌)</span>}
                              </div>
                              <div className="pos-result-meta">
                                باركود: {p.barcode || "—"} | الرصيد: <strong className={isOut ? styles.outOfStockStock : ""}>{stockCount}</strong> قطعة
                              </div>
                            </div>
                            <div className={`pos-result-price ${isOut ? styles.outOfStockText : ""}`}>
                              {formatNumber(p.sellingPrice)} ج.م
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Cart Top Bar (Full Width) */}
              <div className="pos-cart-top-bar">
                <div className={`pos-cart-title-text ${styles.cartTitleText}`}>
                  <ShoppingCart size={22} color="var(--rose-600)" />
                  <span>سلة البيع ({cart.reduce((a, c) => a + c.quantity, 0)} قطعة)</span>
                </div>

                <div className="pos-cart-actions-group">
                  {/* Held Invoices */}
                  <button
                    type="button"
                    onClick={() => setIsHeldInvoicesModalOpen(true)}
                    className={`btn-pos-held-invoices ${styles.heldInvoicesBtn}`}
                    title="استعراض الفواتير المعلقة"
                  >
                    <FolderClock size={16} />
                    <span>المعلقة</span>
                    {heldInvoices.length > 0 && (
                      <span className="pos-badge-held-counter">{heldInvoices.length}</span>
                    )}
                  </button>

                  {/* Hold Current Cart */}
                  {cart.length > 0 && (
                    <button
                      onClick={handleHoldInvoice}
                      className="btn-pos-hold-action"
                      title="تعليق الفاتورة الحالية لخدمة زبون آخر"
                    >
                      <PauseCircle size={15} />
                      <span>تعليق</span>
                    </button>
                  )}

                  {/* Clear Cart */}
                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      className="btn-pos-clear-action"
                      title="تفريغ السلة"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Responsive Cards Grid for Cart Products (Concept 2) */}
              {cart.length === 0 ? (
                <div className={`pos-cart-empty-placeholder ${styles.cartEmptyPlaceholder}`} style={{ minHeight: "260px" }}>
                  <ShoppingCart size={46} color="var(--text-muted)" className={styles.cartEmptyIcon} />
                  <p className={styles.cartEmptyTitle} style={{ fontSize: "1.1rem", fontWeight: "800", marginTop: "8px" }}>
                    سلة البيع فارغة حالياً
                  </p>
                  <span>امسح باركود المنتج أو ابحث باسمه في شريط البحث بالأعلى لإضافته فوراً</span>
                </div>
              ) : (
                <div className={styles.cartCardsGrid}>
                  {cart.map((item) => {
                    const liveStock = shopProducts.find(p => p.id === (item.productId || item.id))?.quantity ?? item.stock ?? 0;
                    const remainingStockAfterCart = Math.max(0, liveStock - item.quantity);
                    const isLowStock = liveStock <= 3;

                    return (
                      <div key={item.id} className={styles.posItemCard}>
                        <div>
                          <div className={styles.cardTopRow}>
                            <div className={styles.cardProductIconWrap}>
                              <Sparkles size={16} />
                            </div>
                            <div className={styles.cardInfoWrap}>
                              <div className={styles.cardProductName}>{item.name}</div>
                              <div className={styles.cardBadgesRow}>
                                {item.barcode && (
                                  <span className={styles.cardBarcodePill}>
                                    باركود: {item.barcode}
                                  </span>
                                )}
                                <span
                                  className={isLowStock ? styles.stockPillLow : styles.stockPillNormal}
                                  title="إجمالي الكمية المتوفرة بالمحل"
                                >
                                  📦 بالمحل: <strong className="num-font" dir="ltr">{liveStock}</strong>
                                </span>
                                <span className={styles.remainingShopStock} title="المتبقي بعد خصم كمية السلة">
                                  بعد السلة: <strong className="num-font" dir="ltr">{remainingStockAfterCart}</strong>
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id)}
                              className={styles.cardBtnDelete}
                              title="حذف الصنف من السلة"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        <div className={styles.cardBottomRow}>
                          <div className={styles.cardPriceBlock}>
                            <span className={styles.cardUnitPrice}>
                              {formatNumber(item.sellingPrice)} ج.م للقطعة
                            </span>
                            <div className={styles.cardTotalPrice}>
                              {formatNumber(item.sellingPrice * item.quantity)} <small>ج.م</small>
                            </div>
                          </div>

                          <div className={styles.cardStepperGroup}>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              className={styles.cardBtnStepper}
                              title="زيادة الكمية"
                            >
                              <Plus size={13} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={liveStock || item.stock}
                              value={item.quantity}
                              onChange={(e) => setDirectQuantity(item.id, e.target.value)}
                              className={styles.qtyDirectInput}
                              title="تعديل الكمية مباشرة بالأرقام"
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              className={styles.cardBtnStepper}
                              title="إنقاص الكمية"
                            >
                              <Minus size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Floating Bottom Checkout Trigger Bar (Concept 2) */}
              {cart.length > 0 && (
                <div
                  className={styles.floatingCheckoutBar}
                  onClick={() => setIsCheckoutDrawerOpen(true)}
                  title="متابعة الدفع وإنهاء الفاتورة (F2)"
                >
                  <div className={styles.floatingCartSummary}>
                    <span className={styles.floatingItemsCount}>
                      {cart.reduce((a, c) => a + c.quantity, 0)} قطعة بالسلة
                    </span>
                    <div className={styles.floatingTotalAmount}>
                      {formatNumber(cartFinalTotal)} <small>ج.م</small>
                    </div>
                  </div>

                  <button type="button" className={styles.floatingActionBtn}>
                    <CreditCard size={18} />
                    <span>متابعة الدفع [F2] ←</span>
                  </button>
                </div>
              )}

              {/* Slide-Over Checkout Drawer Backdrop Overlay */}
              {isCheckoutDrawerOpen && (
                <div
                  className={`${styles.drawerOverlay} ${styles.drawerOverlayOpen}`}
                  onClick={() => setIsCheckoutDrawerOpen(false)}
                />
              )}

              {/* Side-Over Checkout Drawer Panel */}
              <aside
                className={`${styles.sideDrawer} ${isCheckoutDrawerOpen ? styles.sideDrawerOpen : ""}`}
                aria-label="لوحة الدفع والتحصيل"
              >
                <div className={styles.drawerHeader}>
                  <div className={styles.drawerHeaderTitle}>
                    <CreditCard size={20} color="var(--rose-600)" />
                    <span>بيانات الدفع والتحصيل</span>
                    <span className={styles.drawerBadge}>
                      {cart.reduce((a, c) => a + c.quantity, 0)} قطعة
                    </span>
                  </div>

                  <button
                    type="button"
                    className={styles.drawerCloseBtn}
                    onClick={() => setIsCheckoutDrawerOpen(false)}
                    title="إغلاق (Esc)"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className={styles.drawerBody}>
                  {/* Customer Selector Row */}
                  <div className="pos-control-row">
                    <div className="pos-label-between">
                      <span className="pos-label-title">
                        <User size={15} color="var(--rose-600)" />
                        <span>العميل</span>
                      </span>
                      <button
                        onClick={() => setIsNewCustomerModalOpen(true)}
                        className="btn-pos-quick-add-customer"
                        type="button"
                      >
                        <UserPlus size={14} />
                        <span>+ عميل جديد</span>
                      </button>
                    </div>
                    <select
                      value={selectedCustomer?.id || ""}
                      onChange={(e) => {
                        const c = customers.find(item => item.id === e.target.value);
                        setSelectedCustomer(c || null);
                      }}
                      className={`pos-select-box ${styles.selectInput}`}
                    >
                      <option value="">عميل نقدي (بدون حساب آجل)</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sales Employee Selector Row */}
                  <div className="pos-control-row">
                    <div className="pos-label-between">
                      <span className="pos-label-title">
                        <Users size={15} color="var(--rose-600)" />
                        <span>موظف المبيعات / البائعة <span style={{ color: "#f43f5e", fontWeight: "bold" }}>* (إلزامي)</span></span>
                      </span>
                    </div>
                    <select
                      value={selectedSellerEmployee?.id || ""}
                      onChange={(e) => {
                        const emp = employees.find(item => item.id === e.target.value);
                        setSelectedSellerEmployee(emp || null);
                      }}
                      className={`pos-select-box ${styles.selectInput}`}
                      style={{
                        borderColor: !selectedSellerEmployee ? "rgba(244, 63, 94, 0.5)" : "var(--rose-200)",
                        backgroundColor: !selectedSellerEmployee ? "rgba(244, 63, 94, 0.03)" : ""
                      }}
                    >
                      <option value="">-- اختر البائعة المسؤولة عن الفاتورة --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} (كود: {emp.code}) - عمولة {((emp.commissionRate || 0.01) * 100).toFixed(0)}%
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Discount Row with Wholesale Barrier */}
                  <div className="pos-control-row">
                    <div className="pos-label-between">
                      <span className="pos-label-title">
                        <span>خصم الفاتورة</span>
                      </span>
                      <div className="pos-discount-chips-wrap">
                        <button
                          type="button"
                          onClick={() => setDiscountType("fixed")}
                          className={`pos-chip-toggle ${discountType === "fixed" ? "active" : ""}`}
                        >
                          ج.م
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountType("percent")}
                          className={`pos-chip-toggle ${discountType === "percent" ? "active" : ""}`}
                        >
                          %
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      placeholder="قيمة الخصم..."
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className={`pos-input-general ${styles.discountInput}`}
                    />

                    {isDiscountViolatingWholesale && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-1.5 mt-1">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>ممنوع: الخصم يخفض الإجمالي لسعر جملة البضاعة ({cartTotalCost} ج.م) أو أقل منه.</span>
                      </div>
                    )}
                  </div>

                  {/* Payment Methods */}
                  <div className="pos-control-row">
                    <span className="pos-label-title mb-1">طريقة الدفع:</span>
                    <div className="pos-payment-selector-grid">
                      {["نقدي", "فيزا", "تحويل", "آجل"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          className={`btn-pos-method-choice ${paymentMethod === m ? "active" : ""} ${styles.methodBtn}`}
                        >
                          {m === "نقدي" && <Banknote size={15} />}
                          {m === "فيزا" && <CreditCard size={15} />}
                          {m === "تحويل" && <Smartphone size={15} />}
                          {m === "آجل" && <Clock size={15} />}
                          <span>{m}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Received Cash Input */}
                  <div className="pos-control-row">
                    <div className="pos-label-between">
                      <span className="pos-label-title">المبلغ المستلم من العميل:</span>
                      {cartFinalTotal > 0 && (
                        <button
                          type="button"
                          onClick={() => setReceivedCash(cartFinalTotal.toString())}
                          className="btn-pos-quick-add-customer"
                        >
                          المبلغ بالكامل ({formatNumber(cartFinalTotal)} ج.م)
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder={`المطلوب سداده: ${formatNumber(cartFinalTotal)} ج.م`}
                      value={receivedCash}
                      onChange={(e) => setReceivedCash(e.target.value)}
                      className={`pos-input-general font-mono font-bold text-base ${styles.receivedInput}`}
                    />

                    {/* Instant visual indicator for remaining / change */}
                    {cartFinalTotal > 0 && receivedCash !== "" && parsedReceivedCash > 0 && (
                      <div className={`pos-received-feedback ${changeForCustomer > 0 ? "change-mode" : remainingDue > 0 ? "debt-mode" : "exact-mode"}`}>
                        {changeForCustomer > 0 && (
                          <div className={styles.receivedFeedbackRow}>
                            <span className={styles.feedbackLabel}>
                              <Coins size={16} />
                              <span>المتبقي للعميل (الباقي / الفكة المسترجعة):</span>
                            </span>
                            <span className={styles.feedbackValue}>
                              {formatNumber(changeForCustomer)} ج.م
                            </span>
                          </div>
                        )}

                        {remainingDue > 0 && (
                          <div className={styles.receivedFeedbackRow}>
                            <span className={styles.feedbackLabel}>
                              <AlertCircle size={16} />
                              <span>المتبقي على العميل (المطلوب سداده):</span>
                            </span>
                            <span className={styles.feedbackValue}>
                              {formatNumber(remainingDue)} ج.م
                            </span>
                          </div>
                        )}

                        {parsedReceivedCash === cartFinalTotal && (
                          <div className={styles.receivedFeedbackRow}>
                            <span className={styles.feedbackLabel}>
                              <CheckCircle2 size={16} />
                              <span>تم استلام المبلغ بالكامل بالضبط:</span>
                            </span>
                            <span className={styles.feedbackExactValue}>
                              المتبقي: 0 ج.م
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Order Notes Input */}
                  <div className="pos-control-row">
                    <span className="pos-label-title mb-1">ملاحظات الفاتورة:</span>
                    <input
                      type="text"
                      placeholder="أي ملاحظات خاصة بالفاتورة..."
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className={`pos-input-general ${styles.discountInput}`}
                    />
                  </div>

                  {/* Net Bill Breakdown & Total */}
                  <div className={`pos-net-summary-panel ${styles.netSummaryPanel}`}>
                    <div className="pos-calc-row">
                      <span>إجمالي سعر الأصناف:</span>
                      <span className={`font-mono font-bold ${styles.subtotalVal}`}>{formatNumber(cartSubtotal)} ج.م</span>
                    </div>

                    {calculatedDiscount > 0 && (
                      <div className="pos-calc-row text-red-500">
                        <span>الخصم المطبق:</span>
                        <span className={`font-mono font-bold ${styles.discountVal}`}>-{formatNumber(calculatedDiscount)} ج.م</span>
                      </div>
                    )}

                    <div className="pos-calc-row pos-row-grand-total">
                      <span className="font-bold text-sm text-[var(--text-primary)]">الصافي المطلوب:</span>
                      <span className={`pos-grand-price-text ${styles.grandTotalVal}`}>
                        {formatNumber(cartFinalTotal)} ج.م
                      </span>
                    </div>

                    {/* When customer gives more -> change / remainder to return */}
                    {changeForCustomer > 0 && (
                      <div className="pos-calc-row pos-row-change">
                        <span className="flex items-center gap-1 font-bold">
                          <Coins size={14} />
                          <span>المتبقي للعميل (الباقي):</span>
                        </span>
                        <span className="font-mono font-black text-base">
                          {formatNumber(changeForCustomer)} ج.م
                        </span>
                      </div>
                    )}

                    {/* When customer gives less -> remainder still owed */}
                    {remainingDue > 0 && (
                      <div className="pos-calc-row pos-row-debt">
                        <span className="flex items-center gap-1 font-bold">
                          <AlertCircle size={14} />
                          <span>{paymentMethod === "آجل" ? "المتبقي في حساب العميل (آجل):" : "المتبقي المطلوب سداده:"}</span>
                        </span>
                        <span className="font-mono font-black text-base">
                          {formatNumber(remainingDue)} ج.م
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Big Checkout Action Button */}
                  <button
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || isDiscountViolatingWholesale || isSubmitting}
                    className={`btn-pos-submit-sale ${styles.submitSaleBtn}`}
                  >
                    {isSubmitting ? (
                      <span>جاري إصدار الفاتورة...</span>
                    ) : (
                      <>
                        <CheckCircle2 size={22} />
                        <span>إتمام عملية البيع وطباعة الفاتورة ({formatNumber(cartFinalTotal)} ج.م) [F2]</span>
                      </>
                    )}
                  </button>
                </div>
              </aside>

            </div>
          ) : (
            <POSShiftInvoices
              show={showShiftInvoices}
              onClose={() => setShowShiftInvoices(false)}
              invoiceSearchQuery={invoiceSearchQuery}
              setInvoiceSearchQuery={setInvoiceSearchQuery}
              paymentFilter={paymentFilter}
              setPaymentFilter={setPaymentFilter}
              loading={loading}
              currentShiftSales={activeShiftSales}
              filteredShiftSales={filteredShiftSales}
              onInspectInvoice={(inv) => setSelectedInvoiceForDetails(inv)}
              onPrintInvoice={(inv) => {
                setCompletedInvoice(inv);
                setIsReceiptModalOpen(true);
              }}
              onReturnFullInvoice={handleReturnFullInvoice}
            />
          )}
        </div>
      </div>

      {/* MODAL 1: Invoice Items Details & Return */}
      <POSInvoiceDetailsModal
        invoice={selectedInvoiceForDetails}
        onClose={() => setSelectedInvoiceForDetails(null)}
        onReturnItem={handleReturnItem}
        onReturnFullInvoice={handleReturnFullInvoice}
        onPrintInvoice={(inv) => {
          setCompletedInvoice(inv);
          setIsReceiptModalOpen(true);
        }}
      />

      {/* MODAL 2: Return Single Item */}
      <POSReturnModal
        itemToReturn={itemToReturn}
        onClose={() => setItemToReturn(null)}
        returnQuantity={returnQuantity}
        setReturnQuantity={setReturnQuantity}
        returnReason={returnReason}
        setReturnReason={setReturnReason}
        isReturning={isReturning}
        onConfirmReturn={handleConfirmReturnItem}
      />

      {/* MODAL 3: Close Shift Confirmation */}
      <POSCloseShiftModal
        isOpen={isCloseShiftModalOpen}
        onClose={() => setIsCloseShiftModalOpen(false)}
        shiftStats={shiftStats}
        shiftNotes={shiftNotes}
        setShiftNotes={setShiftNotes}
        isClosingShift={isClosingShift}
        onConfirmCloseShift={handleConfirmCloseShift}
      />

      {/* MODAL 4: Suspended Invoices */}
      <POSHeldInvoicesModal
        isOpen={isHeldInvoicesModalOpen}
        onClose={() => setIsHeldInvoicesModalOpen(false)}
        heldInvoices={heldInvoices}
        onRestore={handleRestoreHeldInvoice}
        onDelete={handleDeleteHeldInvoice}
      />

      {/* MODAL 5: Add Customer */}
      <POSNewCustomerModal
        isOpen={isNewCustomerModalOpen}
        onClose={() => setIsNewCustomerModalOpen(false)}
        newCustomerName={newCustomerName}
        setNewCustomerName={setNewCustomerName}
        newCustomerPhone={newCustomerPhone}
        setNewCustomerPhone={setNewCustomerPhone}
        onSubmit={handleAddNewCustomer}
      />

      {/* =========================================================
          MODAL 6: Receipt Print / Share
          ========================================================= */}
      {isReceiptModalOpen && completedInvoice && (
        <POSReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setCompletedInvoice(null);
          }}
          invoice={completedInvoice}
          onNewSale={() => {
            setIsReceiptModalOpen(false);
            setCompletedInvoice(null);
          }}
        />
      )}
    </div>
  );
}
