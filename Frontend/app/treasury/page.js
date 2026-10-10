"use client";

import React, { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import TreasuryTransactionModal from "@/components/treasury/TreasuryTransactionModal";
import PermissionDeniedModal from "@/components/PermissionDeniedModal";
import { 
  subscribeToReports, 
  subscribeToSales 
} from "@/lib/salesService";
import { 
  subscribeToAllMonthlyExpenses 
} from "@/lib/expensesService";
import { 
  subscribeToSuppliers 
} from "@/lib/suppliersService";
import { 
  subscribeToCustomers 
} from "@/lib/customersService";
import { 
  subscribeToProducts 
} from "@/lib/productsService";
import { 
  subscribeToShopProducts 
} from "@/lib/shopService";
import { 
  subscribeToTreasuryTransactions, 
  recordTreasuryTransaction, 
  deleteTreasuryTransaction 
} from "@/lib/treasuryService";
import { 
  formatNumber, 
  roundCurrency, 
  getLocalDateString 
} from "@/lib/utils";
import { 
  Landmark, 
  Wallet, 
  CreditCard, 
  Banknote, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Boxes, 
  Store, 
  Users, 
  Truck, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowRightLeft, 
  PlusCircle, 
  MinusCircle, 
  Trash2, 
  Search, 
  Filter, 
  Calendar, 
  RefreshCw,
  PieChart,
  Coins,
  ShieldCheck,
  Sparkles,
  Info
} from "lucide-react";
import confetti from "canvas-confetti";
import styles from "./treasury.module.css";

export default function TreasuryPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  // Subscribed states
  const [reports, setReports] = useState([]);
  const [activeSales, setActiveSales] = useState([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [warehouseProducts, setWarehouseProducts] = useState([]);
  const [shopProducts, setShopProducts] = useState([]);
  const [treasuryTxs, setTreasuryTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  // Balances per channel from the backend's single cash-flow definition (same numbers as the shift drawer).
  const [cashflow, setCashflow] = useState(null);

  // Modals & UI States
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState("إيداع");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [permissionDeniedAction, setPermissionDeniedAction] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  // Filters for ledger
  const [activeFilterTab, setActiveFilterTab] = useState("all"); // "all" | "inflows" | "outflows" | "transfers" | "sales" | "expenses"
  const [selectedVaultFilter, setSelectedVaultFilter] = useState("all"); // "all" | "نقدي" | "فيزا" | "محفظة إلكترونية"
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    return api.subscribe(() => api.get("/finance/cashflow"), (d) => { if (d && d.cash) setCashflow(d); });
  }, [user]);

  // Real-time Subscriptions across all financial channels
  useEffect(() => {
    if (!user) return;

    let loaded = 0;
    const markLoaded = () => {
      loaded++;
      if (loaded >= 8) setLoading(false);
    };

    const unsubReports = subscribeToReports((data) => {
      setReports(data);
      markLoaded();
    });

    const unsubSales = subscribeToSales((data) => {
      setActiveSales(data.filter(s => s.status !== "مرتجعة"));
      markLoaded();
    });

    const unsubExpenses = subscribeToAllMonthlyExpenses((data) => {
      setMonthlyExpenses(data);
      markLoaded();
    });

    const unsubSuppliers = subscribeToSuppliers((data) => {
      setSuppliers(data);
      markLoaded();
    });

    const unsubCustomers = subscribeToCustomers((data) => {
      setCustomers(data);
      markLoaded();
    });

    const unsubWarehouse = subscribeToProducts((data) => {
      setWarehouseProducts(data);
      markLoaded();
    });

    const unsubShop = subscribeToShopProducts((data) => {
      setShopProducts(data);
      markLoaded();
    });

    const unsubTreasury = subscribeToTreasuryTransactions((data) => {
      setTreasuryTxs(data);
      markLoaded();
    });

    return () => {
      unsubReports();
      unsubSales();
      unsubExpenses();
      unsubSuppliers();
      unsubCustomers();
      unsubWarehouse();
      unsubShop();
      unsubTreasury();
    };
  }, [user]);

  // =========================================================================
  // FINANCIAL CALCULATION ENGINE
  // =========================================================================

  // 1. Sales & Inflows Breakdown (Lifetime)
  const salesMetrics = useMemo(() => {
    let closedSalesTotal = 0;
    let closedSalesCost = 0;
    let closedSalesProfit = 0;
    let closedPaidTotal = 0;

    let cashFromReports = 0;
    let visaFromReports = 0;
    let walletsFromReports = 0;
    let creditFromReports = 0;

    reports.forEach((rep) => {
      closedSalesTotal += Number(rep.totalSales) || 0;
      closedSalesCost += Number(rep.totalCost) || 0;
      closedSalesProfit += Number(rep.totalProfit) || 0;
      closedPaidTotal += Number(rep.totalPaid) || 0;

      const bk = rep.paymentBreakdown || {};
      cashFromReports += Number(bk["نقدي"] || bk["كاش"] || 0);
      visaFromReports += Number(bk["فيزا"] || 0);
      walletsFromReports += Number(bk["تحويل"] || bk["فودافون كاش"] || bk["محفظة"] || bk["محفظة إلكترونية"] || 0);
      creditFromReports += Number(bk["آجل"] || 0);
    });

    // Active open shift sales
    let activeSalesTotal = 0;
    let activeSalesCost = 0;
    let activeSalesProfit = 0;
    let activePaidTotal = 0;

    let cashFromActive = 0;
    let visaFromActive = 0;
    let walletsFromActive = 0;
    let creditFromActive = 0;

    activeSales.forEach((s) => {
      const tot = Number(s.total) || 0;
      const paid = Number(s.paidAmount) || (s.paymentMethod === "آجل" ? 0 : tot);
      const cost = Number(s.totalCost) || 0;
      const profit = Number(s.totalProfit) || 0;

      activeSalesTotal += tot;
      activeSalesCost += cost;
      activeSalesProfit += profit;
      activePaidTotal += paid;

      const m = s.paymentMethod || "نقدي";
      if (m === "نقدي" || m === "كاش") {
        cashFromActive += paid;
      } else if (m === "فيزا") {
        visaFromActive += paid;
      } else if (m === "تحويل" || m === "فودافون كاش" || m === "محفظة إلكترونية" || m === "محفظة") {
        walletsFromActive += paid;
      } else if (m === "آجل") {
        creditFromActive += (tot - paid);
      }
    });

    const lifetimeSalesTotal = roundCurrency(closedSalesTotal + activeSalesTotal);
    const lifetimeSalesCost = roundCurrency(closedSalesCost + activeSalesCost);
    const lifetimeSalesProfit = roundCurrency(closedSalesProfit + activeSalesProfit);
    const lifetimePaidSales = roundCurrency(closedPaidTotal + activePaidTotal);

    const lifetimeCashSales = roundCurrency(cashFromReports + cashFromActive);
    const lifetimeVisaSales = roundCurrency(visaFromReports + visaFromActive);
    const lifetimeWalletsSales = roundCurrency(walletsFromReports + walletsFromActive);
    const lifetimeCreditSales = roundCurrency(creditFromReports + creditFromActive);

    return {
      lifetimeSalesTotal,
      lifetimeSalesCost,
      lifetimeSalesProfit,
      lifetimePaidSales,
      lifetimeCashSales,
      lifetimeVisaSales,
      lifetimeWalletsSales,
      lifetimeCreditSales,
      reportsCount: reports.length,
      activeInvoicesCount: activeSales.length
    };
  }, [reports, activeSales]);

  // 2. Expenses Breakdown (Lifetime)
  const expensesMetrics = useMemo(() => {
    let totalExpenses = 0;
    let cashExpenses = 0;
    let visaExpenses = 0;
    let walletsExpenses = 0;

    monthlyExpenses.forEach((mRec) => {
      const txs = mRec.transactions || [];
      txs.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        totalExpenses += amt;
        const method = tx.method || "نقدي";
        if (method === "نقدي" || method === "كاش") {
          cashExpenses += amt;
        } else if (method === "فيزا" || method === "بطاقة بنكية") {
          visaExpenses += amt;
        } else if (method === "فودافون كاش" || method === "تحويل بنكي" || method === "محفظة إلكترونية" || method === "شيك") {
          walletsExpenses += amt;
        } else {
          cashExpenses += amt;
        }
      });
    });

    return {
      totalExpenses: roundCurrency(totalExpenses),
      cashExpenses: roundCurrency(cashExpenses),
      visaExpenses: roundCurrency(visaExpenses),
      walletsExpenses: roundCurrency(walletsExpenses)
    };
  }, [monthlyExpenses]);

  // 3. Supplier Payments & Inflows/Outflows
  const supplierMetrics = useMemo(() => {
    let totalSupplierDebt = 0;
    let supplierCashPaid = 0;
    let supplierVisaPaid = 0;
    let supplierWalletsPaid = 0;

    suppliers.forEach((s) => {
      totalSupplierDebt += Number(s.balance) || 0;
      const txs = s.transactions || [];
      txs.forEach((t) => {
        if (t.type === "سداد دفعة" || t.type === "سداد نقدي" || t.type === "سداد شيك" || t.type === "payment") {
          const amt = Number(t.amount) || 0;
          const m = t.method || "نقدي";
          if (m === "نقدي" || m === "كاش") {
            supplierCashPaid += amt;
          } else if (m === "فيزا" || m === "تحويل بنكي") {
            supplierVisaPaid += amt;
          } else {
            supplierWalletsPaid += amt;
          }
        }
      });
    });

    return {
      totalSupplierDebt: roundCurrency(totalSupplierDebt),
      supplierCashPaid: roundCurrency(supplierCashPaid),
      supplierVisaPaid: roundCurrency(supplierVisaPaid),
      supplierWalletsPaid: roundCurrency(supplierWalletsPaid)
    };
  }, [suppliers]);

  // 4. Customer Collections & Receivables
  const customerMetrics = useMemo(() => {
    let totalCustomerDebt = 0;
    let customerCashCollected = 0;
    let customerVisaCollected = 0;
    let customerWalletsCollected = 0;

    customers.forEach((c) => {
      totalCustomerDebt += Number(c.balance) || 0;
      const txs = c.transactions || [];
      txs.forEach((t) => {
        if (String(t.type || "").startsWith("سداد") || t.type === "payment") {
          const amt = Number(t.amount) || 0;
          const m = t.method || "نقدي";
          if (m === "نقدي" || m === "كاش") {
            customerCashCollected += amt;
          } else if (m === "فيزا") {
            customerVisaCollected += amt;
          } else {
            customerWalletsCollected += amt;
          }
        }
      });
    });

    return {
      totalCustomerDebt: roundCurrency(totalCustomerDebt),
      customerCashCollected: roundCurrency(customerCashCollected),
      customerVisaCollected: roundCurrency(customerVisaCollected),
      customerWalletsCollected: roundCurrency(customerWalletsCollected)
    };
  }, [customers]);

  // 5. Stock Assets Valuation (Shop & Warehouse)
  const stockMetrics = useMemo(() => {
    let warehouseWholesaleValue = 0;
    let warehouseRetailValue = 0;
    let warehouseTotalQty = 0;

    warehouseProducts.forEach((p) => {
      const q = Math.max(0, parseInt(p.quantity, 10) || 0);
      const w = Number(p.wholesalePrice) || 0;
      const r = Number(p.sellingPrice) || 0;
      warehouseWholesaleValue += q * w;
      warehouseRetailValue += q * r;
      warehouseTotalQty += q;
    });

    let shopWholesaleValue = 0;
    let shopRetailValue = 0;
    let shopTotalQty = 0;

    shopProducts.forEach((p) => {
      const q = Math.max(0, parseInt(p.quantity, 10) || 0);
      const w = Number(p.wholesalePrice) || 0;
      const r = Number(p.sellingPrice) || 0;
      shopWholesaleValue += q * w;
      shopRetailValue += q * r;
      shopTotalQty += q;
    });

    const totalStockCost = roundCurrency(warehouseWholesaleValue + shopWholesaleValue);
    const totalStockRetail = roundCurrency(warehouseRetailValue + shopRetailValue);
    const expectedInventoryProfit = roundCurrency(totalStockRetail - totalStockCost);

    return {
      warehouseWholesaleValue: roundCurrency(warehouseWholesaleValue),
      warehouseRetailValue: roundCurrency(warehouseRetailValue),
      warehouseTotalQty,
      shopWholesaleValue: roundCurrency(shopWholesaleValue),
      shopRetailValue: roundCurrency(shopRetailValue),
      shopTotalQty,
      totalStockCost,
      totalStockRetail,
      expectedInventoryProfit
    };
  }, [warehouseProducts, shopProducts]);

  // 6. Manual Treasury Transactions (Deposits, Withdrawals, Transfers)
  const treasuryManualMetrics = useMemo(() => {
    let manualCashIn = 0;
    let manualCashOut = 0;
    let manualVisaIn = 0;
    let manualVisaOut = 0;
    let manualWalletsIn = 0;
    let manualWalletsOut = 0;

    treasuryTxs.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "إيداع") {
        if (tx.fromMethod === "نقدي" || tx.fromMethod === "كاش") manualCashIn += amt;
        else if (tx.fromMethod === "فيزا") manualVisaIn += amt;
        else manualWalletsIn += amt;
      } else if (tx.type === "سحب") {
        if (tx.fromMethod === "نقدي" || tx.fromMethod === "كاش") manualCashOut += amt;
        else if (tx.fromMethod === "فيزا") manualVisaOut += amt;
        else manualWalletsOut += amt;
      } else if (tx.type === "تحويل") {
        // Out from source
        if (tx.fromMethod === "نقدي" || tx.fromMethod === "كاش") manualCashOut += amt;
        else if (tx.fromMethod === "فيزا") manualVisaOut += amt;
        else manualWalletsOut += amt;

        // In to destination
        if (tx.toMethod === "نقدي" || tx.toMethod === "كاش") manualCashIn += amt;
        else if (tx.toMethod === "فيزا") manualVisaIn += amt;
        else manualWalletsIn += amt;
      }
    });

    return {
      manualCashIn: roundCurrency(manualCashIn),
      manualCashOut: roundCurrency(manualCashOut),
      manualVisaIn: roundCurrency(manualVisaIn),
      manualVisaOut: roundCurrency(manualVisaOut),
      manualWalletsIn: roundCurrency(manualWalletsIn),
      manualWalletsOut: roundCurrency(manualWalletsOut)
    };
  }, [treasuryTxs]);

  // 7. Net Liquidity by Channel & Total Liquid Capital
  const liquidityMetrics = useMemo(() => {
    // 💵 Cash in Hand (الدرج والخزنة)
    const cashInflows = roundCurrency(
      salesMetrics.lifetimeCashSales +
      customerMetrics.customerCashCollected +
      treasuryManualMetrics.manualCashIn
    );
    const cashOutflows = roundCurrency(
      expensesMetrics.cashExpenses +
      supplierMetrics.supplierCashPaid +
      treasuryManualMetrics.manualCashOut
    );
    const netCashBalance = roundCurrency(cashInflows - cashOutflows);

    // 💳 Visa / Bank Cards (الفيزا والحساب البنكي)
    const visaInflows = roundCurrency(
      salesMetrics.lifetimeVisaSales +
      customerMetrics.customerVisaCollected +
      treasuryManualMetrics.manualVisaIn
    );
    const visaOutflows = roundCurrency(
      expensesMetrics.visaExpenses +
      supplierMetrics.supplierVisaPaid +
      treasuryManualMetrics.manualVisaOut
    );
    const netVisaBalance = roundCurrency(visaInflows - visaOutflows);

    // 📱 E-Wallets / Vodafone Cash / InstaPay (المحافظ الإلكترونية)
    const walletsInflows = roundCurrency(
      salesMetrics.lifetimeWalletsSales +
      customerMetrics.customerWalletsCollected +
      treasuryManualMetrics.manualWalletsIn
    );
    const walletsOutflows = roundCurrency(
      expensesMetrics.walletsExpenses +
      supplierMetrics.supplierWalletsPaid +
      treasuryManualMetrics.manualWalletsOut
    );
    const netWalletsBalance = roundCurrency(walletsInflows - walletsOutflows);

    // 🪙 Total Liquid Available
    const totalLiquidity = roundCurrency(netCashBalance + netVisaBalance + netWalletsBalance);

    if (cashflow) {
      // authoritative: includes returns paid back, money paid on purchase invoices, employee advances and
      // customer payments that the screen-side estimate above misses
      const c = cashflow.cash, v = cashflow.visa, w = cashflow.wallets;
      return {
        cashInflows: c.in, cashOutflows: c.out, netCashBalance: c.net,
        visaInflows: v.in, visaOutflows: v.out, netVisaBalance: v.net,
        walletsInflows: w.in, walletsOutflows: w.out, netWalletsBalance: w.net,
        totalLiquidity: roundCurrency(c.net + v.net + w.net),
      };
    }

    return {
      cashInflows,
      cashOutflows,
      netCashBalance,
      visaInflows,
      visaOutflows,
      netVisaBalance,
      walletsInflows,
      walletsOutflows,
      netWalletsBalance,
      totalLiquidity
    };
  }, [salesMetrics, expensesMetrics, supplierMetrics, customerMetrics, treasuryManualMetrics, cashflow]);

  // 8. Total Working Capital & Project Net Worth
  const projectCapitalMetrics = useMemo(() => {
    // Total Business Profit = Lifetime Sales - Lifetime Cost - Total Expenses
    const netOperationalProfit = roundCurrency(
      salesMetrics.lifetimeSalesTotal - 
      salesMetrics.lifetimeSalesCost - 
      expensesMetrics.totalExpenses
    );

    // Total Project Net Worth (رأس مال المشروع الكلي والأصول)
    // = Net Liquidity + Total Stock (Shop + Warehouse Wholesale) + Customer Debts - Supplier Debts
    const totalNetWorth = roundCurrency(
      liquidityMetrics.totalLiquidity + 
      stockMetrics.totalStockCost + 
      customerMetrics.totalCustomerDebt - 
      supplierMetrics.totalSupplierDebt
    );

    return {
      netOperationalProfit,
      totalNetWorth
    };
  }, [salesMetrics, expensesMetrics, liquidityMetrics, stockMetrics, customerMetrics, supplierMetrics]);

  // =========================================================================
  // UNIFIED LEDGER TRANSACTIONS BUILDER
  // =========================================================================
  const unifiedLedger = useMemo(() => {
    const list = [];

    // 1. Manual Treasury Transactions
    treasuryTxs.forEach((t) => {
      list.push({
        id: `tx_${t.id}`,
        rawId: t.id,
        isManual: true,
        date: t.date || t.createdAt,
        type: t.type, // "إيداع" | "سحب" | "تحويل"
        category: t.category || "حركة خزنة",
        amount: Number(t.amount) || 0,
        fromMethod: t.fromMethod || "نقدي",
        toMethod: t.toMethod || null,
        notes: t.notes || "",
        actor: t.createdBy?.name || "المسؤول",
        badgeColor: t.type === "إيداع" ? "green" : t.type === "سحب" ? "red" : "blue"
      });
    });

    // 2. Closed Reports (Sales Inflow)
    reports.forEach((rep) => {
      const repDate = rep.closedAt || rep.date || rep.createdAt;
      const salesVal = Number(rep.totalSales) || 0;
      if (salesVal > 0) {
        list.push({
          id: `rep_${rep.id}`,
          isManual: false,
          date: repDate,
          type: "إيراد مبيعات",
          category: `تقفيلة وردية (${rep.reportNumber || 'أرشيف'})`,
          amount: salesVal,
          fromMethod: "مقسم (كاش/فيزا/محفظة)",
          notes: `${rep.invoicesCount || 0} فاتورة مباعة • كاش: ${formatNumber(rep.paymentBreakdown?.["نقدي"] || 0)} ج.م`,
          actor: rep.closedBy?.name || "كاشير المحل",
          badgeColor: "emerald"
        });
      }
    });

    // 3. Monthly Expenses (Outflows)
    monthlyExpenses.forEach((mRec) => {
      const txs = mRec.transactions || [];
      txs.forEach((tx) => {
        list.push({
          id: `exp_${tx.id || Math.random()}`,
          isManual: false,
          date: tx.date || mRec.month,
          type: "مصروف تشغيلي",
          category: mRec.itemName || "مصروف عام",
          amount: Number(tx.amount) || 0,
          fromMethod: tx.method || "نقدي",
          notes: tx.notes || "صرف نثريات/تشغيل",
          actor: "الإدارة",
          badgeColor: "amber"
        });
      });
    });

    // Sort all descending by date
    list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return list;
  }, [treasuryTxs, reports, monthlyExpenses]);

  // Filtered Ledger
  const filteredLedger = useMemo(() => {
    return unifiedLedger.filter((item) => {
      // Tab filter
      if (activeFilterTab === "inflows" && item.type !== "إيداع" && item.type !== "إيراد مبيعات") return false;
      if (activeFilterTab === "outflows" && item.type !== "سحب" && item.type !== "مصروف تشغيلي") return false;
      if (activeFilterTab === "transfers" && item.type !== "تحويل") return false;
      if (activeFilterTab === "sales" && item.type !== "إيراد مبيعات") return false;
      if (activeFilterTab === "expenses" && item.type !== "مصروف تشغيلي") return false;

      // Vault filter
      if (selectedVaultFilter !== "all") {
        const matchesFrom = item.fromMethod && item.fromMethod.includes(selectedVaultFilter);
        const matchesTo = item.toMethod && item.toMethod.includes(selectedVaultFilter);
        if (!matchesFrom && !matchesTo && item.fromMethod !== "مقسم (كاش/فيزا/محفظة)") {
          return false;
        }
      }

      // Date filter
      if (dateFilter) {
        const itemDateStr = getLocalDateString(item.date);
        if (!itemDateStr.startsWith(dateFilter)) return false;
      }

      // Search term filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const cat = (item.category || "").toLowerCase();
        const notes = (item.notes || "").toLowerCase();
        const actor = (item.actor || "").toLowerCase();
        const type = (item.type || "").toLowerCase();
        if (!cat.includes(term) && !notes.includes(term) && !actor.includes(term) && !type.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedLedger, activeFilterTab, selectedVaultFilter, dateFilter, searchTerm]);

  // Handle Opening Transaction Modal
  const handleOpenTxModal = (type = "إيداع") => {
    if (!isAdmin) {
      setPermissionDeniedAction("إجراء حركة مالية في الخزنة");
      return;
    }
    setTxModalType(type);
    setIsTxModalOpen(true);
  };

  // Handle Save Transaction
  const handleSaveTransaction = async (txData) => {
    try {
      await recordTreasuryTransaction(txData);
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 }
      });
      showToast("تم تسجيل الحركة المالية في الخزنة بنجاح!");
    } catch (err) {
      console.error("Save treasury tx error:", err);
      showToast(err.message || "فشل تسجيل الحركة المالية.");
    }
  };

  // Handle Delete Manual Transaction
  const handleDeleteTransaction = async (rawId) => {
    if (!isAdmin) {
      setPermissionDeniedAction("حذف حركة مالية من الخزنة");
      return;
    }
    if (!confirm("هل أنت متأكد من حذف هذه الحركة المالية من الخزنة؟")) return;

    try {
      await deleteTreasuryTransaction(rawId);
      showToast("تم حذف الحركة المالية بنجاح.");
    } catch (err) {
      console.error("Delete treasury tx error:", err);
      showToast("فشل حذف الحركة.");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="app-layout">
        <Sidebar isMobileOpen={isMobileSidebarOpen} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
        <div className="main-content">
          <Navbar onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
          <div className={styles.loadingContainer}>
            <div className="app-loading-spinner" />
            <p className={styles.loadingText}>جاري تحميل البيانات المالية وحسابات الخزائن والأصول...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar 
        isMobileOpen={isMobileSidebarOpen} 
        onCloseMobile={() => setIsMobileSidebarOpen(false)} 
      />

      <div className="main-content">
        {/* Navbar */}
        <Navbar onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />

        {/* Toast Notification */}
        {toastMessage && (
          <div className="toast-notification">
            <Sparkles size={16} />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className={styles.pageContainer}>
          {/* Header Banner */}
          <div className={styles.headerBanner}>
            <div className={styles.headerInfo}>
              <div className={styles.headerIconWrap}>
                <Landmark size={28} />
              </div>
              <div>
                <h1 className={styles.pageTitle}>الخزنة والسيولة ورأس مال المشروع</h1>
                <p className={styles.pageSubtitle}>
                  المركز المالي المتكامل • مراقبة دقيقة لكافة التدفقات النقدية، تفصيل أرصدة الخزن (كاش / فيزا / محافظ)، وجرد أصول المشروع.
                </p>
              </div>
            </div>

            {/* Quick Actions Buttons */}
            {isAdmin && (
              <div className={styles.headerActions}>
                <button 
                  onClick={() => handleOpenTxModal("إيداع")}
                  className={`btn-primary ${styles.actionBtnInflow}`}
                >
                  <PlusCircle size={17} />
                  <span>سند قبض / إيداع</span>
                </button>

                <button 
                  onClick={() => handleOpenTxModal("سحب")}
                  className={`btn-secondary ${styles.actionBtnOutflow}`}
                >
                  <MinusCircle size={17} />
                  <span>سند صرف / مسحوبات</span>
                </button>

                <button 
                  onClick={() => handleOpenTxModal("تحويل")}
                  className={`btn-secondary ${styles.actionBtnTransfer}`}
                >
                  <ArrowRightLeft size={17} />
                  <span>تحويل بين الخزن</span>
                </button>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* HERO KPI CARDS: Total Net Worth & High-Level Metrics      */}
          {/* ========================================================= */}
          <div className={styles.kpiGridTop}>
            {/* 1. Total Net Worth / Working Capital */}
            <div className={`${styles.kpiCard} ${styles.kpiCardNetWorth}`}>
              <div className={styles.kpiCardHeader}>
                <span className={styles.kpiLabel}>رأس مال المشروع الإجمالي (صافي القيمة)</span>
                <div className={`${styles.kpiIconWrap} ${styles.iconPurple}`}>
                  <Landmark size={22} />
                </div>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={`num-font ${styles.kpiLargeNumber}`} dir="ltr">
                  {formatNumber(projectCapitalMetrics.totalNetWorth)}
                </span>
                <span className={styles.currencySymbol}>ج.م</span>
              </div>
              <p className={styles.kpiHint}>
                السيولة النقدية + قيمة بضاعة المحل والمخزن + ديون العملاء - مستحقات الموردين
              </p>
            </div>

            {/* 2. Total Liquid Available */}
            <div className={`${styles.kpiCard} ${styles.kpiCardLiquidity}`}>
              <div className={styles.kpiCardHeader}>
                <span className={styles.kpiLabel}>إجمالي السيولة النقدية الجاهزة</span>
                <div className={`${styles.kpiIconWrap} ${styles.iconEmerald}`}>
                  <Coins size={22} />
                </div>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={`num-font ${styles.kpiLargeNumber}`} dir="ltr">
                  {formatNumber(liquidityMetrics.totalLiquidity)}
                </span>
                <span className={styles.currencySymbol}>ج.م</span>
              </div>
              <p className={styles.kpiHint}>
                مجموع المبالغ النقدية المتوفرة حالياً في (الدرج + الفيزا + المحافظ)
              </p>
            </div>

            {/* 3. Net Operational Profit */}
            <div className={`${styles.kpiCard} ${styles.kpiCardProfit}`}>
              <div className={styles.kpiCardHeader}>
                <span className={styles.kpiLabel}>صافي أرباح النشاط التراكمية</span>
                <div className={`${styles.kpiIconWrap} ${styles.iconBlue}`}>
                  <TrendingUp size={22} />
                </div>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={`num-font ${styles.kpiLargeNumber}`} dir="ltr">
                  {formatNumber(projectCapitalMetrics.netOperationalProfit)}
                </span>
                <span className={styles.currencySymbol}>ج.م</span>
              </div>
              <p className={styles.kpiHint}>
                إجمالي المبيعات ({formatNumber(salesMetrics.lifetimeSalesTotal)}) - تكلفة البضاعة - إجمالي المصاريف
              </p>
            </div>

            {/* 4. Total Expenses */}
            <div className={`${styles.kpiCard} ${styles.kpiCardExpenses}`}>
              <div className={styles.kpiCardHeader}>
                <span className={styles.kpiLabel}>إجمالي المصاريف والنفقات</span>
                <div className={`${styles.kpiIconWrap} ${styles.iconRose}`}>
                  <TrendingDown size={22} />
                </div>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={`num-font ${styles.kpiLargeNumber}`} dir="ltr">
                  {formatNumber(expensesMetrics.totalExpenses)}
                </span>
                <span className={styles.currencySymbol}>ج.م</span>
              </div>
              <p className={styles.kpiHint}>
                كافة النفقات التشغيلية والرواتب والإيجارات المسجلة في سجل المصاريف
              </p>
            </div>
          </div>

          {/* ========================================================= */}
          {/* THREE CORE VAULTS: CASH / VISA / WALLETS                  */}
          {/* ========================================================= */}
          <div className={styles.sectionTitleRow}>
            <div className={styles.sectionTitleContent}>
              <Wallet size={20} color="var(--rose-600)" />
              <h2 className={styles.sectionTitle}>تفصيل أرصدة الخزائن وقنوات الدفع</h2>
            </div>
            <span className={styles.sectionBadge}>محدث لحظياً ⚡</span>
          </div>

          <div className={styles.vaultsGrid}>
            {/* 1. CASH VAULT (الدرج والخزنة النقدية) */}
            <div className={`${styles.vaultBox} ${styles.vaultBoxCash}`}>
              <div className={styles.vaultHeader}>
                <div className={styles.vaultIconTitle}>
                  <div className={`${styles.vaultIcon} ${styles.vaultIconCash}`}>
                    <Banknote size={22} />
                  </div>
                  <div>
                    <h3 className={styles.vaultName}>خزينة النقدية (الكاش بالدرج)</h3>
                    <span className={styles.vaultSub}>النقدية السائلة المتوفرة فعلياً بالمتجر</span>
                  </div>
                </div>
              </div>

              <div className={styles.vaultBalanceWrap}>
                <span className={styles.vaultBalLabel}>الرصيد الفعلي المتوفر:</span>
                <div className={styles.vaultMainBalance}>
                  <strong className={`num-font ${styles.vaultNum}`} dir="ltr">
                    {formatNumber(liquidityMetrics.netCashBalance)}
                  </strong>
                  <span className={styles.vaultCurrency}>ج.م</span>
                </div>
              </div>

              <div className={styles.vaultStatsBreakdown}>
                <div className={styles.vaultStatRow}>
                  <span className={styles.statLabelInflow}>
                    <ArrowDownLeft size={14} /> إجمالي المقبوضات (كاش):
                  </span>
                  <strong className="num-font" dir="ltr">+{formatNumber(liquidityMetrics.cashInflows)} ج.م</strong>
                </div>
                <div className={styles.vaultStatRow}>
                  <span className={styles.statLabelOutflow}>
                    <ArrowUpRight size={14} /> إجمالي المصروفات (كاش):
                  </span>
                  <strong className="num-font" dir="ltr">-{formatNumber(liquidityMetrics.cashOutflows)} ج.م</strong>
                </div>
              </div>
            </div>

            {/* 2. VISA / BANK VAULT (الفيزا والحساب البنكي) */}
            <div className={`${styles.vaultBox} ${styles.vaultBoxVisa}`}>
              <div className={styles.vaultHeader}>
                <div className={styles.vaultIconTitle}>
                  <div className={`${styles.vaultIcon} ${styles.vaultIconVisa}`}>
                    <CreditCard size={22} />
                  </div>
                  <div>
                    <h3 className={styles.vaultName}>خزينة الفيزا والحساب البنكي</h3>
                    <span className={styles.vaultSub}>مدفوعات البطاقات وماكينة POS البنكية</span>
                  </div>
                </div>
              </div>

              <div className={styles.vaultBalanceWrap}>
                <span className={styles.vaultBalLabel}>الرصيد الفعلي المتوفر:</span>
                <div className={styles.vaultMainBalance}>
                  <strong className={`num-font ${styles.vaultNum}`} dir="ltr">
                    {formatNumber(liquidityMetrics.netVisaBalance)}
                  </strong>
                  <span className={styles.vaultCurrency}>ج.م</span>
                </div>
              </div>

              <div className={styles.vaultStatsBreakdown}>
                <div className={styles.vaultStatRow}>
                  <span className={styles.statLabelInflow}>
                    <ArrowDownLeft size={14} /> إجمالي المقبوضات (فيزا):
                  </span>
                  <strong className="num-font" dir="ltr">+{formatNumber(liquidityMetrics.visaInflows)} ج.م</strong>
                </div>
                <div className={styles.vaultStatRow}>
                  <span className={styles.statLabelOutflow}>
                    <ArrowUpRight size={14} /> إجمالي المصروفات (فيزا):
                  </span>
                  <strong className="num-font" dir="ltr">-{formatNumber(liquidityMetrics.visaOutflows)} ج.م</strong>
                </div>
              </div>
            </div>

            {/* 3. E-WALLETS VAULT (فودافون كاش وإنستاباي) */}
            <div className={`${styles.vaultBox} ${styles.vaultBoxWallets}`}>
              <div className={styles.vaultHeader}>
                <div className={styles.vaultIconTitle}>
                  <div className={`${styles.vaultIcon} ${styles.vaultIconWallets}`}>
                    <Wallet size={22} />
                  </div>
                  <div>
                    <h3 className={styles.vaultName}>خزينة المحافظ والتحويلات</h3>
                    <span className={styles.vaultSub}>فودافون كاش، إنستاباي، والمحافظ الرقمية</span>
                  </div>
                </div>
              </div>

              <div className={styles.vaultBalanceWrap}>
                <span className={styles.vaultBalLabel}>الرصيد الفعلي المتوفر:</span>
                <div className={styles.vaultMainBalance}>
                  <strong className={`num-font ${styles.vaultNum}`} dir="ltr">
                    {formatNumber(liquidityMetrics.netWalletsBalance)}
                  </strong>
                  <span className={styles.vaultCurrency}>ج.م</span>
                </div>
              </div>

              <div className={styles.vaultStatsBreakdown}>
                <div className={styles.vaultStatRow}>
                  <span className={styles.statLabelInflow}>
                    <ArrowDownLeft size={14} /> إجمالي المقبوضات (محافظ):
                  </span>
                  <strong className="num-font" dir="ltr">+{formatNumber(liquidityMetrics.walletsInflows)} ج.م</strong>
                </div>
                <div className={styles.vaultStatRow}>
                  <span className={styles.statLabelOutflow}>
                    <ArrowUpRight size={14} /> إجمالي المصروفات (محافظ):
                  </span>
                  <strong className="num-font" dir="ltr">-{formatNumber(liquidityMetrics.walletsOutflows)} ج.م</strong>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* BALANCE SHEET & ASSETS VALUATION PANEL                    */}
          {/* ========================================================= */}
          <div className={styles.sectionTitleRow}>
            <div className={styles.sectionTitleContent}>
              <PieChart size={20} color="var(--rose-600)" />
              <h2 className={styles.sectionTitle}>جرد الأصول، المخزون، والالتزامات المالية</h2>
            </div>
            <span className={styles.sectionBadge}>قيمة رأس المال المخزن</span>
          </div>

          <div className={styles.assetsGrid}>
            {/* Shop Stock Asset */}
            <div className={styles.assetCard}>
              <div className={styles.assetHeader}>
                <div className={`${styles.assetIcon} ${styles.iconPink}`}>
                  <Store size={20} />
                </div>
                <div>
                  <h4 className={styles.assetTitle}>بضاعة المحل (المعرض)</h4>
                  <span className={styles.assetQty}>{formatNumber(stockMetrics.shopTotalQty)} قطعة متوفرة</span>
                </div>
              </div>
              <div className={styles.assetBody}>
                <div className={styles.assetRow}>
                  <span>سعر الجملة (رأس المال):</span>
                  <strong className="num-font" dir="ltr">{formatNumber(stockMetrics.shopWholesaleValue)} ج.م</strong>
                </div>
                <div className={styles.assetRow}>
                  <span>سعر البيع المتوقع:</span>
                  <strong className="num-font text-emerald-600" dir="ltr">{formatNumber(stockMetrics.shopRetailValue)} ج.م</strong>
                </div>
              </div>
            </div>

            {/* Warehouse Stock Asset */}
            <div className={styles.assetCard}>
              <div className={styles.assetHeader}>
                <div className={`${styles.assetIcon} ${styles.iconPurple}`}>
                  <Boxes size={20} />
                </div>
                <div>
                  <h4 className={styles.assetTitle}>بضاعة المخزن الرئيسي</h4>
                  <span className={styles.assetQty}>{formatNumber(stockMetrics.warehouseTotalQty)} قطعة متوفرة</span>
                </div>
              </div>
              <div className={styles.assetBody}>
                <div className={styles.assetRow}>
                  <span>سعر الجملة (رأس المال):</span>
                  <strong className="num-font" dir="ltr">{formatNumber(stockMetrics.warehouseWholesaleValue)} ج.م</strong>
                </div>
                <div className={styles.assetRow}>
                  <span>سعر البيع المتوقع:</span>
                  <strong className="num-font text-emerald-600" dir="ltr">{formatNumber(stockMetrics.warehouseRetailValue)} ج.م</strong>
                </div>
              </div>
            </div>

            {/* Customer Receivables */}
            <div className={styles.assetCard}>
              <div className={styles.assetHeader}>
                <div className={`${styles.assetIcon} ${styles.iconBlue}`}>
                  <Users size={20} />
                </div>
                <div>
                  <h4 className={styles.assetTitle}>مستحقات على العملاء (الآجل)</h4>
                  <span className={styles.assetQty}>ديون مستحقة لصالح المشروع</span>
                </div>
              </div>
              <div className={styles.assetBody}>
                <div className={styles.assetRow}>
                  <span>إجمالي الديون الآجلة:</span>
                  <strong className="num-font text-blue-600 font-bold" dir="ltr">+{formatNumber(customerMetrics.totalCustomerDebt)} ج.م</strong>
                </div>
                <div className={styles.assetRow}>
                  <span>حالة التحصيل:</span>
                  <span className="text-xs text-slate-500">أصل مالي متداول</span>
                </div>
              </div>
            </div>

            {/* Supplier Payables */}
            <div className={styles.assetCard}>
              <div className={styles.assetHeader}>
                <div className={`${styles.assetIcon} ${styles.iconAmber}`}>
                  <Truck size={20} />
                </div>
                <div>
                  <h4 className={styles.assetTitle}>مستحقات للموردين (الالتزامات)</h4>
                  <span className={styles.assetQty}>ديون واجبة السداد للموردين</span>
                </div>
              </div>
              <div className={styles.assetBody}>
                <div className={styles.assetRow}>
                  <span>إجمالي ديون الموردين:</span>
                  <strong className="num-font text-red-600 font-bold" dir="ltr">-{formatNumber(supplierMetrics.totalSupplierDebt)} ج.م</strong>
                </div>
                <div className={styles.assetRow}>
                  <span>حالة الالتزام:</span>
                  <span className="text-xs text-red-500">خصم من صافي القيمة</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* UNIFIED TREASURY LEDGER TABLE                             */}
          {/* ========================================================= */}
          <div className={styles.ledgerSection}>
            <div className={styles.ledgerHeader}>
              <div>
                <h3 className={styles.ledgerTitle}>سجل حركات الخزنة والتدفقات النقدية الموحد</h3>
                <p className={styles.ledgerSub}>
                  أرشيف شامل ومفصل لكافة العمليات المالية، سندات القبض والصرف، مبيعات الورديات، والمصاريف التشغيلية.
                </p>
              </div>

              {/* Filters Toolbar */}
              <div className={styles.filterToolbar}>
                {/* Search Bar */}
                <div className={styles.searchBox}>
                  <Search size={16} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="ابحث بالبيان، التصنيف، المسؤول..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>

                {/* Vault Filter */}
                <select
                  value={selectedVaultFilter}
                  onChange={(e) => setSelectedVaultFilter(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="all">جميع الخزائن</option>
                  <option value="نقدي">خزينة النقدية (الكاش)</option>
                  <option value="فيزا">خزينة الفيزا والبنك</option>
                  <option value="محفظة">خزينة المحافظ الإلكترونية</option>
                </select>

                {/* Date Filter */}
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className={`num-font ${styles.dateInput}`}
                />
                {dateFilter && (
                  <button 
                    onClick={() => setDateFilter("")}
                    className={styles.clearDateBtn}
                    title="إلغاء فلتر التاريخ"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className={styles.tabsRow}>
              {[
                { id: "all", label: "جميع الحركات" },
                { id: "inflows", label: "المقبوضات والإيرادات" },
                { id: "outflows", label: "المدفوعات والمصاريف" },
                { id: "transfers", label: "التحويلات بين الخزن" },
                { id: "sales", label: "مبيعات الورديات" },
                { id: "expenses", label: "المصاريف التشغيلية" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilterTab(tab.id)}
                  className={`${styles.tabBtn} ${activeFilterTab === tab.id ? styles.tabBtnActive : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Ledger Table */}
            <div className={styles.tableWrap}>
              {filteredLedger.length === 0 ? (
                <div className={styles.emptyTable}>
                  <Info size={36} color="var(--rose-600)" />
                  <p className={styles.emptyTitle}>لا توجد حركات مالية مطابقة للفلاتر المحددة</p>
                  <p className={styles.emptySub}>يمكنك تغيير خيارات الفلترة أو تسجيل سند جديد في الخزنة.</p>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>التاريخ والتوقيت</th>
                      <th>نوع الحركة</th>
                      <th>التصنيف / البيان</th>
                      <th>الخزينة المستهدفة</th>
                      <th>المبلغ</th>
                      <th>المسؤول</th>
                      <th>ملاحظات</th>
                      {isAdmin && <th className="text-center">إجراءات</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map((tx) => {
                      const isDeposit = tx.type === "إيداع" || tx.type === "إيراد مبيعات";
                      const isWithdraw = tx.type === "سحب" || tx.type === "مصروف تشغيلي";
                      const isTransfer = tx.type === "تحويل";

                      return (
                        <tr key={tx.id} className={styles.tableRow}>
                          {/* Date */}
                          <td className="num-font text-xs" dir="ltr">
                            {tx.date ? new Date(tx.date).toLocaleString("ar-EG", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            }) : "—"}
                          </td>

                          {/* Type */}
                          <td>
                            <span className={`${styles.badge} ${styles[`badge_${tx.badgeColor}`]}`}>
                              {isDeposit && <ArrowDownLeft size={13} />}
                              {isWithdraw && <ArrowUpRight size={13} />}
                              {isTransfer && <ArrowRightLeft size={13} />}
                              <span>{tx.type}</span>
                            </span>
                          </td>

                          {/* Category */}
                          <td>
                            <strong className={styles.txCategory}>{tx.category}</strong>
                          </td>

                          {/* Vault / Method */}
                          <td>
                            {isTransfer ? (
                              <div className={styles.transferVaultWrap}>
                                <span className={styles.fromVault}>{tx.fromMethod}</span>
                                <ArrowRightLeft size={12} />
                                <span className={styles.toVault}>{tx.toMethod}</span>
                              </div>
                            ) : (
                              <span className={styles.vaultTag}>{tx.fromMethod}</span>
                            )}
                          </td>

                          {/* Amount */}
                          <td>
                            <strong className={`num-font ${isDeposit ? styles.amtGreen : isWithdraw ? styles.amtRed : styles.amtBlue}`} dir="ltr">
                              {isDeposit ? "+" : isWithdraw ? "-" : ""}{formatNumber(tx.amount)} ج.م
                            </strong>
                          </td>

                          {/* Actor */}
                          <td className="text-xs text-slate-600">
                            {tx.actor || "—"}
                          </td>

                          {/* Notes */}
                          <td className="text-xs text-slate-500 max-w-xs truncate">
                            {tx.notes || "—"}
                          </td>

                          {/* Actions */}
                          {isAdmin && (
                            <td className="text-center">
                              {tx.isManual ? (
                                <button
                                  onClick={() => handleDeleteTransaction(tx.rawId)}
                                  className={styles.deleteTxBtn}
                                  title="حذف الحركة"
                                >
                                  <Trash2 size={15} />
                                </button>
                              ) : (
                                <span className={styles.systemLockedTag} title="حركة مسجلة آلياً من النظام">
                                  نظامي
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Modal */}
      <TreasuryTransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        initialType={txModalType}
        currentUser={user}
        onSave={handleSaveTransaction}
      />

      {/* Permission Denied Modal */}
      {permissionDeniedAction && (
        <PermissionDeniedModal
          isOpen={true}
          onClose={() => setPermissionDeniedAction(null)}
          actionName={permissionDeniedAction}
        />
      )}
    </div>
  );
}
