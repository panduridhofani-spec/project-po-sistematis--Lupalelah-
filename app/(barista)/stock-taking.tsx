import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TextInput, RefreshControl, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { AppCard } from '../../src/components/AppCard';
import { AppButton } from '../../src/components/AppButton';
import { AppTextInput } from '../../src/components/AppTextInput';
import { FadeInView } from '../../src/components/FadeInView';
import { Typography } from '../../src/constants/Typography';
import { Spacing, Radius } from '../../src/constants/Colors';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../src/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, addDoc, updateDoc, Timestamp, getDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { ProductWithCategory } from '../../src/types/master';
import { StockTakingItem, PurchaseOrder, POItem } from '../../src/types/stock';
import { getOperationalDate } from '../../src/utils/date';
import { AppAlert } from '../../src/components/AppAlert';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

type StockInputState = Record<string, { in: string, out: string, end: string, po: string }>;

const parseStock = (val?: string) => {
  if (!val) return 0;
  const n = parseFloat(val.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export default function StockTakingScreen() {
  const { colors } = useTheme();
  const { user, activeShift, activeLeader } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [shiftNumber, setShiftNumber] = useState<number>(activeShift || 1);
  const initialDate = useMemo(() => getOperationalDate(), []);
  const [operationalDate, setOperationalDate] = useState(initialDate);

  const [stockInputs, setStockInputs] = useState<StockInputState>({});
  const [beginningStock, setBeginningStock] = useState<Record<string, number>>({});
  const [inStock, setInStock] = useState<Record<string, number>>({}); // From Validated POs
  
  const [isCompleted, setIsCompleted] = useState(false);
  const [existingItems, setExistingItems] = useState<Record<string, { actual: number, status: string, in: number, out: number }>>({});
  const [categoryLayouts, setCategoryLayouts] = useState<Record<string, number>>({});
  
  const [unfilledItems, setUnfilledItems] = useState<string[]>([]);
  const [activeOrders, setActiveOrders] = useState<Record<string, boolean>>({});
  const [itemLayouts, setItemLayouts] = useState<Record<string, number>>({});
  const scrollViewRef = React.useRef<ScrollView>(null);
  
  // Validation Modal State
  const [pendingPOs, setPendingPOs] = useState<PurchaseOrder[]>([]);
  const [validatedPOs, setValidatedPOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [validationInputs, setValidationInputs] = useState<Record<string, string>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  const [isBlockedByPrevious, setIsBlockedByPrevious] = useState(false);
  const [previousShiftStr, setPreviousShiftStr] = useState('');

  const isShiftReadOnly = shiftNumber !== activeShift;
  const isPoAllowed = shiftNumber === 2 || shiftNumber === 4;

  useEffect(() => {
    if (activeShift) setShiftNumber(activeShift);
  }, [activeShift]);

  // 1. Initial Load & Refresh Logic
  useEffect(() => {
    fetchData();
  }, [shiftNumber, operationalDate]);

  // 2. Realtime Listener for Pending POs
  useEffect(() => {
    if (!shiftNumber || !operationalDate) return;
    
    const q = query(
      collection(db, 'purchase_orders'),
      where('target_operational_date', '==', operationalDate),
      where('target_shift_number', '==', shiftNumber),
      where('status', '==', 'SENT')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pending: PurchaseOrder[] = [];
      snapshot.forEach(doc => {
        pending.push({ id: doc.id, ...doc.data() } as PurchaseOrder);
      });
      setPendingPOs(pending);
      
      setSelectedPO(currentSelected => {
        if (currentSelected && !pending.find(p => p.id === currentSelected.id)) {
          return null; 
        }
        return currentSelected;
      });
    }, (error) => {
      console.error("Realtime PO listener error:", error);
    });

    return () => {
      unsubscribe();
    };
  }, [shiftNumber, operationalDate]);

  const fetchData = async () => {
    setLoading(true);
    setIsCompleted(false);
    setExistingItems({});
    setInStock({});
    setUnfilledItems([]);
    setPendingPOs([]);
    setActiveOrders({});
    
    try {
      // 1. Fetch Categories
      const categoriesSnap = await getDocs(collection(db, 'categories'));
      const categoryMap: Record<string, string> = {};
      categoriesSnap.forEach(doc => {
        categoryMap[doc.id] = doc.data().name;
      });

      // 2. Fetch Products
      const productsSnap = await getDocs(query(collection(db, 'products'), where('active', '==', true)));
      const fetchedProducts: ProductWithCategory[] = [];
      productsSnap.forEach(doc => {
        const p = doc.data() as ProductWithCategory;
        p.id = doc.id;
        p.categories = { id: p.category_id, name: categoryMap[p.category_id] || 'Lainnya', active: true };
        fetchedProducts.push(p);
      });
      setProducts(fetchedProducts);

      // 2. Fetch Previous Shift Stock (AWAL)
      let bgStock: Record<string, number> = {};
      let prevShiftCompleted = false;
      
      let prevShiftNum = shiftNumber - 1;
      let prevShiftDate = operationalDate;
      if (prevShiftNum === 0) {
        prevShiftNum = 4;
        const d = new Date(prevShiftDate);
        d.setDate(d.getDate() - 1);
        prevShiftDate = d.toISOString().split('T')[0];
      }
      
      setPreviousShiftStr(`Shift ${prevShiftNum} · ${prevShiftDate}`);

      // Check if this is the very first time using the app (empty DB)
      const allStockSnap = await getDocs(query(collection(db, 'stock_takings')));
      const isFirstEverUse = allStockSnap.empty;

      if (!isFirstEverUse) {
        const prevStockSnap = await getDocs(query(
          collection(db, 'stock_takings'),
          where('operational_date', '==', prevShiftDate),
          where('shift_number', '==', prevShiftNum)
        ));
        
        if (!prevStockSnap.empty) {
          prevShiftCompleted = true;
          const prevData = prevStockSnap.docs[0].data();
          prevData.items?.forEach((item: StockTakingItem) => {
            bgStock[item.product_id] = item.actual_stock;
          });
        }
      } else {
        prevShiftCompleted = true; // Allow if DB is totally fresh
      }
      
      setBeginningStock(bgStock);
      setIsBlockedByPrevious(!prevShiftCompleted);

      // 3. Fetch Validated POs for this shift (IN)
      const validatedPOsSnap = await getDocs(query(
        collection(db, 'purchase_orders'),
        where('target_operational_date', '==', operationalDate),
        where('target_shift_number', '==', shiftNumber),
        where('status', '==', 'COMPLETE')
      ));
      
      const inStk: Record<string, number> = {};
      const vPos: PurchaseOrder[] = [];
      validatedPOsSnap.forEach(doc => {
        const po = { id: doc.id, ...doc.data() } as PurchaseOrder;
        vPos.push(po);
        po.items.forEach(item => {
          inStk[item.product_id] = (inStk[item.product_id] || 0) + (item.validated_quantity || 0);
        });
      });
      setInStock(inStk);
      setValidatedPOs(vPos);

      // 4. Fetch Pending POs manually to guarantee data on load/refresh
      const pendingPOsSnap = await getDocs(query(
        collection(db, 'purchase_orders'),
        where('target_operational_date', '==', operationalDate),
        where('target_shift_number', '==', shiftNumber),
        where('status', '==', 'SENT')
      ));
      
      const pending: PurchaseOrder[] = [];
      pendingPOsSnap.forEach(doc => {
        pending.push({ id: doc.id, ...doc.data() } as PurchaseOrder);
      });
      setPendingPOs(pending);

      // 4b. Fetch All Active POs (PENDING or SENT) to show indicator on items
      const activePOsSnap = await getDocs(query(
        collection(db, 'purchase_orders'),
        where('status', 'in', ['PENDING', 'SENT'])
      ));
      
      const ordersMap: Record<string, boolean> = {};
      
      for (const poDoc of activePOsSnap.docs) {
        const poData = poDoc.data() as PurchaseOrder;
        if (!poData.items || poData.items.length === 0) {
          const itemsQ = query(collection(db, 'purchase_order_items'), where('purchase_order_id', '==', poDoc.id));
          const itemsSnap = await getDocs(itemsQ);
          itemsSnap.forEach(itemDoc => {
            const item = itemDoc.data() as StockTakingItem;
            ordersMap[item.product_id] = true;
          });
        } else {
          poData.items.forEach(item => {
            ordersMap[item.product_id] = true;
          });
        }
      }
      setActiveOrders(ordersMap);

      // 5. Check Current Shift Stock Taking (If already completed)
      const currentStockSnap = await getDocs(query(
        collection(db, 'stock_takings'),
        where('operational_date', '==', operationalDate),
        where('shift_number', '==', shiftNumber)
      ));

      if (!currentStockSnap.empty) {
        setIsCompleted(true);
        const data = currentStockSnap.docs[0].data();
        const itemsMap: Record<string, { actual: number, status: string, in: number, out: number }> = {};
        data.items?.forEach((item: StockTakingItem) => {
          itemsMap[item.product_id] = {
            actual: item.actual_stock,
            status: item.stock_status,
            in: item.in_stock,
            out: item.out_stock
          };
        });
        setExistingItems(itemsMap);
      } else {
        // Initialize Inputs
        const draftKey = `draft_stock_${shiftNumber}_${operationalDate}`;
        const draftStr = await AsyncStorage.getItem(draftKey);
        let draftData: StockInputState | null = null;
        if (draftStr) {
          try { draftData = JSON.parse(draftStr); } catch (e) {}
        }
        
        const initialInputs: StockInputState = {};
        fetchedProducts.forEach(p => {
          let itemDraft = draftData && draftData[p.id] 
            ? { ...draftData[p.id] } 
            : { in: '', out: '', end: '', po: '' };
          
          const poQty = inStk[p.id] || 0;
          if (poQty > 0) {
            const currentIn = parseStock(itemDraft.in || '0');
            if (currentIn < poQty) {
              itemDraft.in = poQty.toString();
            }
          }
          initialInputs[p.id] = itemDraft;
        });
        setStockInputs(initialInputs);
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      AppAlert.show('Error', 'Gagal memuat data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Helper to persist draft
  const saveDraft = async (newInputs: StockInputState) => {
    try {
      const draftKey = `draft_stock_${shiftNumber}_${operationalDate}`;
      await AsyncStorage.setItem(draftKey, JSON.stringify(newInputs));
    } catch (e) {
      console.error('Error saving draft', e);
    }
  };

  // UI Handlers for Calculations (AWAL + PO IN + MANUAL IN - OUT = SISA)
  const handleUpdateIn = (productId: string, inVal: string) => {
    if (inVal !== '' && !/^[0-9.,]+$/.test(inVal)) return;
    setStockInputs(prev => {
      const current = prev[productId] || { in: '0', out: '0', end: '0', po: '' };
      const bg = beginningStock[productId] || 0;
      
      let inNum = 0;
      if (inVal !== '') {
        inNum = parseStock(inVal);
      }
      
      const totalAvailable = bg + inNum;
      let outNum = parseStock(current.out || '0');
      
      // Cap OUT if it exceeds the new total available
      if (outNum > totalAvailable) {
        outNum = totalAvailable;
      }
      
      let newEnd = (totalAvailable - outNum).toString();
      let newOut = outNum.toString();

      const product = products.find(p => p.id === productId);
      let newPo = current.po;
      if (product) {
        if (parseStock(newEnd) < product.safety_stock) newPo = '1';
        else if (parseStock(newEnd) >= product.safety_stock) newPo = '';
      }
      
      const next = { ...prev, [productId]: { ...current, in: inVal, out: newOut, end: newEnd, po: newPo } };
      saveDraft(next);
      return next;
    });
    setUnfilledItems(prev => prev.filter(id => id !== productId));
  };

  const handleUpdateOut = (productId: string, outVal: string) => {
    if (outVal !== '' && !/^[0-9.,]+$/.test(outVal)) return;
    setStockInputs(prev => {
      const current = prev[productId] || { in: '0', out: '0', end: '0', po: '' };
      const bg = beginningStock[productId] || 0;
      const manualIn = parseStock(current.in || '0');
      const totalAvailable = bg + manualIn;
      
      let finalOutVal = outVal;
      let newEnd = current.end;
      
      if (outVal !== '') {
        let outNum = parseStock(outVal);
        if (outNum > totalAvailable) {
          outNum = totalAvailable; // cap out to max available
          finalOutVal = outNum.toString();
        }
        newEnd = (totalAvailable - outNum).toString();
      }

      const product = products.find(p => p.id === productId);
      let newPo = current.po;
      if (product) {
        if (parseStock(newEnd) < product.safety_stock) newPo = '1';
        else if (parseStock(newEnd) >= product.safety_stock) newPo = '';
      }
      
      const next = { ...prev, [productId]: { ...current, out: finalOutVal, end: newEnd, po: newPo } };
      saveDraft(next);
      return next;
    });
    setUnfilledItems(prev => prev.filter(id => id !== productId));
  };

  const handleUpdateEnd = (productId: string, endVal: string) => {
    if (endVal !== '' && !/^[0-9.,]+$/.test(endVal)) return;
    setStockInputs(prev => {
      const current = prev[productId] || { in: '0', out: '0', end: '0', po: '' };
      const bg = beginningStock[productId] || 0;
      const manualIn = parseStock(current.in || '0');
      const totalAvailable = bg + manualIn;
      
      let finalEndVal = endVal;
      let newOut = current.out;
      
      if (endVal !== '') {
        let endNum = parseStock(endVal);
        if (endNum > totalAvailable) {
          endNum = totalAvailable; // cap remaining to max available
          finalEndVal = endNum.toString();
        }
        newOut = (totalAvailable - endNum).toString();
      }

      const product = products.find(p => p.id === productId);
      let newPo = current.po;
      if (product) {
        if (parseStock(finalEndVal) < product.safety_stock) newPo = '1';
        else if (parseStock(finalEndVal) >= product.safety_stock) newPo = '';
      }
      
      const next = { ...prev, [productId]: { ...current, out: newOut, end: finalEndVal, po: newPo } };
      saveDraft(next);
      return next;
    });
    setUnfilledItems(prev => prev.filter(id => id !== productId));
  };

  const handleTogglePo = (productId: string) => {
    setStockInputs(prev => {
      const next = { 
        ...prev, 
        [productId]: { ...prev[productId], po: prev[productId]?.po === '1' ? '' : '1' } 
      };
      saveDraft(next);
      return next;
    });
  };

  const handleSetUnchanged = (productId: string) => {
    const bg = beginningStock[productId] || 0;
    
    setStockInputs(prev => {
      const manualIn = parseStock(prev[productId]?.in || '0');
      const endStock = bg + manualIn;
      
      const product = products.find(p => p.id === productId);
      let newPo = prev[productId]?.po || '';
      if (product) {
        if (endStock < product.safety_stock) newPo = '1';
        else if (endStock >= product.safety_stock) newPo = '';
      }
      const next = {
        ...prev,
        [productId]: { ...prev[productId], out: '0', end: endStock.toString(), po: newPo }
      };
      saveDraft(next);
      return next;
    });
    setUnfilledItems(prev => prev.filter(id => id !== productId));
  };

  // VALIDATION MODAL LOGIC
  const openValidationModal = (po: PurchaseOrder) => {
    setSelectedPO(po);
    const initialVals: Record<string, string> = {};
    po.items.forEach(i => {
      initialVals[i.product_id] = (i.sent_quantity || i.requested_quantity || 0).toString();
    });
    setValidationInputs(initialVals);
    setCheckedItems({});
  };

  const handleValidatePO = async () => {
    if (!selectedPO) return;
    setValidating(true);
    try {
      // Safety check: Make sure it's still SENT
      const poRef = doc(db, 'purchase_orders', selectedPO.id);
      const poSnap = await getDoc(poRef);
      if (poSnap.exists() && poSnap.data().status !== 'SENT') {
        AppAlert.show('Pengiriman Dibatalkan', 'Status pengiriman ini telah diubah atau dibatalkan oleh Logistik. Halaman akan dimuat ulang otomatis.');
        setSelectedPO(null);
        return;
      }

      const updatedItems = selectedPO.items.map(item => ({
        ...item,
        validated_quantity: parseStock(validationInputs[item.product_id] || '0')
      }));

      const hasDiscrepancy = updatedItems.some(i => i.validated_quantity !== i.sent_quantity);
      const notes = hasDiscrepancy 
        ? `Terdapat perbedaan jumlah saat penerimaan oleh Shift ${shiftNumber}` 
        : '';

      await updateDoc(doc(db, 'purchase_orders', selectedPO.id), {
        status: 'COMPLETE',
        items: updatedItems,
        validated_by: user?.uid,
        validated_at: new Date().toISOString(),
        validation_notes: notes,
        has_discrepancy: hasDiscrepancy,
        discrepancy_resolved: true // Auto resolve since no action needed from logistics
      });

      // Auto-increment the "IN" and "SISA" (end) stock
      setStockInputs(prev => {
        const next = { ...prev };
        let changed = false;
        
        updatedItems.forEach(item => {
          const valQty = item.validated_quantity || 0;
          if (valQty > 0) {
            const currentEnd = next[item.product_id]?.end;
            const newEnd = (currentEnd !== undefined && currentEnd !== '') 
              ? (parseStock(currentEnd) + valQty).toString() 
              : '';
              
            const currentIn = next[item.product_id]?.in;
            const newIn = (parseStock(currentIn || '0') + valQty).toString();
            
            next[item.product_id] = {
              ...(next[item.product_id] || { out: '0', po: '' }),
              in: newIn,
              ...(newEnd !== '' ? { end: newEnd } : {})
            };
            changed = true;
          }
        });

        if (changed) saveDraft(next);
        return next;
      });

      AppAlert.show('Sukses', 'Barang berhasil divalidasi dan masuk ke Stok IN.');
      setSelectedPO(null);
      fetchData(); // Refresh to update IN values
    } catch (e) {
      console.error(e);
      AppAlert.show('Error', 'Gagal memvalidasi barang.');
    } finally {
      setValidating(false);
    }
  };

  // SAVE STOCK TAKING
  const handleAttemptSave = () => {
    if (products.length === 0 || isShiftReadOnly) return;
    if (pendingPOs.length > 0) {
      AppAlert.show('Perhatian', 'Anda harus memvalidasi semua barang masuk (PO) terlebih dahulu sebelum menutup shift.');
      return;
    }

    const emptyIds = products.filter(p => stockInputs[p.id]?.end === '' || stockInputs[p.id]?.out === '').map(p => p.id);
    if (emptyIds.length > 0) {
      setUnfilledItems(emptyIds);
      AppAlert.show('Incomplete', 'Masih ada stok yang belum diinputkan.');
      return;
    }
    setUnfilledItems([]);

    AppAlert.show(
      'Konfirmasi Tutup Shift',
      'Apakah Anda yakin stok fisik yang dimasukkan sudah benar? Tindakan ini tidak bisa dibatalkan.',
      [
        { text: 'Periksa Lagi', style: 'cancel' },
        { text: 'Ya, Tutup & Simpan', style: 'destructive', onPress: handleSave }
      ]
    );
  };

  const handleSave = async () => {
    
    setSaving(true);
    try {
      const itemsToSave: StockTakingItem[] = products.map(p => {
        const actual = parseStock(stockInputs[p.id].end || '0');
        const manualIn = parseStock(stockInputs[p.id].in || '0');
        return {
          product_id: p.id,
          beginning_stock: beginningStock[p.id] || 0,
          in_stock: manualIn,
          out_stock: parseStock(stockInputs[p.id].out || '0'),
          actual_stock: actual,
          stock_status: actual < p.safety_stock ? 'NEED_PO' : 'SAFE'
        };
      });

      // 1. Save Stock Taking Document & Update Products
      const stId = generateUUID();
      const batch = writeBatch(db);
      
      const stRef = doc(db, 'stock_takings', stId);
      batch.set(stRef, {
        id: stId,
        operational_date: operationalDate,
        shift_number: shiftNumber,
        taken_by: user?.uid || null,
        taken_by_name: activeLeader?.full_name || 'Leader Barista',
        taken_at: new Date().toISOString(),
        items: itemsToSave
      });

      // Update products collection with new actual_stock
      itemsToSave.forEach(item => {
        const prodRef = doc(db, 'products', item.product_id);
        batch.update(prodRef, { actual_stock: item.actual_stock });
      });

      // 2. Save Regular PO (if shift 2 or 4)
      const poItems = products
        .filter(p => stockInputs[p.id].po && parseStock(stockInputs[p.id].po) > 0)
        .map(p => ({
          product_id: p.id,
          requested_quantity: parseStock(stockInputs[p.id].po)
        }));

      if (poItems.length > 0 && isPoAllowed) {
        // Shift 2 sends to Shift 3 (same day)
        // Shift 4 sends to Shift 2 (next day)
        let targetShift = 3;
        let targetDate = operationalDate;
        if (shiftNumber === 4) {
          targetShift = 2;
          const d = new Date(operationalDate);
          d.setDate(d.getDate() + 1);
          targetDate = d.toISOString().split('T')[0];
        }

        const poId = generateUUID();
        const poRef = doc(db, 'purchase_orders', poId);
        batch.set(poRef, {
          id: poId,
          type: 'REGULAR',
          status: 'PENDING',
          operational_date: operationalDate,
          source_shift_number: shiftNumber,
          target_shift_number: targetShift,
          target_operational_date: targetDate,
          requested_by: user?.uid || null,
          created_by_name: activeLeader?.full_name || 'Leader Barista',
          created_at: new Date().toISOString(),
          items: poItems
        });
      }

      await batch.commit();

      // Clear draft and ongoing state upon successful save
      const draftKey = `draft_stock_${shiftNumber}_${operationalDate}`;
      await AsyncStorage.removeItem(draftKey);
      await AsyncStorage.removeItem('ongoingShift');
      await AsyncStorage.removeItem('ongoingLeader');

      AppAlert.show(
        'Berhasil', 
        poItems.length > 0 ? 'Stock Taking & PO Reguler berhasil disimpan.' : 'Stock Taking berhasil disimpan.', 
        [{ text: 'OK', onPress: () => router.replace('/(barista)') }]
      );
      
    } catch (error: any) {
      console.error('Error saving:', error);
      AppAlert.show('Error', 'Gagal menyimpan stock taking.');
    } finally {
      setSaving(false);
    }
  };



  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  
  const groupedProducts = useMemo(() => {
    const groups: Record<string, ProductWithCategory[]> = {};
    filteredProducts.forEach(p => {
      const catName = p.categories?.name || 'Lainnya';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(p);
    });
    return groups;
  }, [filteredProducts]);

  const scrollToUnfilled = () => {
    if (unfilledItems.length > 0 && scrollViewRef.current) {
      // Find the visual first unfilled item
      let visualFirstId = '';
      let catName = '';
      outerLoop: for (const [c, items] of Object.entries(groupedProducts)) {
        for (const p of items) {
          if (unfilledItems.includes(p.id)) {
            visualFirstId = p.id;
            catName = c;
            break outerLoop;
          }
        }
      }
      
      if (!visualFirstId) return;

      const catY = categoryLayouts[catName] || 0;
      const itemY = itemLayouts[visualFirstId] || 0;
      const yPos = catY + itemY;

      scrollViewRef.current.scrollTo({ y: Math.max(0, yPos - 60), animated: true });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <FadeInView delay={0}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View>
              <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>Cek Stok Penutup</Text>
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>Shift {shiftNumber} · {operationalDate}</Text>
            </View>
          </View>
        </FadeInView>

        {/* Blocking Alert for Previous Shift */}
        {isBlockedByPrevious && !isCompleted && !isShiftReadOnly && (
          <FadeInView delay={50}>
            <AppCard style={{ backgroundColor: colors.outOfStock + '20', borderColor: colors.outOfStock, borderWidth: 1, marginBottom: Spacing.l }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="alert-triangle" size={24} color={colors.outOfStock} style={{ marginRight: Spacing.m }} />
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.cardTitle, { color: colors.outOfStock }]}>Tunggu Sebentar!</Text>
                  <Text style={[Typography.bodySmall, { color: colors.textPrimary }]}>
                    Anda belum bisa mengisi stok atau memvalidasi barang karena <Text style={{ fontWeight: 'bold' }}>{previousShiftStr}</Text> belum menutup stok. Harap minta Shift sebelumnya untuk menyelesaikan laporan terlebih dahulu.
                  </Text>
                </View>
              </View>
            </AppCard>
          </FadeInView>
        )}

        {/* Pending Validation Alert */}
        {!isCompleted && !isShiftReadOnly && !isBlockedByPrevious && pendingPOs.length > 0 && (
          <FadeInView delay={100}>
            <AppCard style={{ backgroundColor: colors.needPo + '20', borderColor: colors.needPo, borderWidth: 1, marginBottom: Spacing.l }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="truck" size={24} color={colors.needPo} style={{ marginRight: Spacing.m }} />
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.cardTitle, { color: colors.needPo }]}>Barang Datang!</Text>
                  <Text style={[Typography.bodySmall, { color: colors.textPrimary }]}>Ada {pendingPOs.length} pengiriman yang harus divalidasi sebelum tutup shift.</Text>
                </View>
              </View>
              {pendingPOs.map(po => (
                <TouchableOpacity 
                  key={po.id} 
                  style={{ marginTop: Spacing.m, backgroundColor: colors.needPo, padding: Spacing.s, borderRadius: Radius.small, alignItems: 'center' }}
                  onPress={() => openValidationModal(po)}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Validasi PO {po.type === 'URGENT' ? 'Urgent' : 'Reguler'}</Text>
                </TouchableOpacity>
              ))}
            </AppCard>
          </FadeInView>
        )}

        {/* Validated POs History Alert */}
        {!isCompleted && !isShiftReadOnly && validatedPOs.length > 0 && (
          <FadeInView delay={120}>
            <AppCard style={{ backgroundColor: colors.safe + '10', borderColor: colors.safe, borderWidth: 1, marginBottom: Spacing.l }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="check-circle" size={24} color={colors.safe} style={{ marginRight: Spacing.m }} />
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.cardTitle, { color: colors.safe }]}>Penerimaan Selesai</Text>
                  <Text style={[Typography.bodySmall, { color: colors.textPrimary }]}>Ada {validatedPOs.length} pengiriman yang telah divalidasi hari ini.</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={{ marginTop: Spacing.m, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.safe, padding: Spacing.s, borderRadius: Radius.small, alignItems: 'center' }}
                onPress={() => setShowHistoryModal(true)}
              >
                <Text style={{ color: colors.safe, fontWeight: 'bold' }}>Lihat Riwayat Penerimaan</Text>
              </TouchableOpacity>
            </AppCard>
          </FadeInView>
        )}

        <FadeInView delay={150}>
          <View style={styles.shiftSelector}>
            {[1, 2, 3, 4].map(shift => (
              <TouchableOpacity
                key={shift}
                style={[
                  styles.shiftChip,
                  { 
                    backgroundColor: shiftNumber === shift ? colors.primary : colors.surface,
                    borderColor: shiftNumber === shift ? colors.primary : colors.border,
                    opacity: (loading || saving) ? 0.6 : 1
                  }
                ]}
                onPress={() => setShiftNumber(shift)}
                disabled={loading || saving}
              >
                <Text style={[Typography.bodyMedium, { color: shiftNumber === shift ? colors.surface : colors.textPrimary }]}>Shift {shift}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FadeInView>

        <FadeInView delay={200}>
          <AppTextInput placeholder="Cari produk..." value={searchQuery} onChangeText={setSearchQuery} editable={!saving} />
        </FadeInView>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: Spacing.xxl }} />
        ) : (
          Object.entries(groupedProducts).map(([category, items], categoryIndex) => (
            <View 
              key={category} 
              style={{ marginTop: Spacing.l }}
              onLayout={(e) => {
                const y = e.nativeEvent.layout.y;
                setCategoryLayouts(prev => ({ ...prev, [category]: y }));
              }}
            >
              {items.map((product, productIndex) => {
                const isUnfilled = unfilledItems.includes(product.id);
                return (
                <View key={product.id} onLayout={(e) => {
                  const y = e.nativeEvent.layout.y;
                  setItemLayouts(prev => ({ ...prev, [product.id]: y }));
                }}>
                  <FadeInView delay={300 + (productIndex * 50)}>
                    <AppCard style={[styles.productCard, isUnfilled && { borderColor: colors.outOfStock, borderWidth: 1 }]}>
                    {isUnfilled && (
                      <View style={{ position: 'absolute', top: -10, right: -10, backgroundColor: colors.outOfStock, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>!</Text>
                      </View>
                    )}
                    <View style={styles.productRow}>
                      <View style={styles.productInfo}>
                        <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>{product.name}</Text>
                        {activeOrders[product.id] && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: colors.warning + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' }}>
                            <Feather name="alert-circle" size={10} color={colors.warning} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 10, color: colors.warning, fontWeight: 'bold' }}>Sedang di-PO</Text>
                          </View>
                        )}
                        
                        {/* Display AWAL */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>AWAL: <Text style={{ fontWeight: 'bold' }}>{beginningStock[product.id] || 0}</Text></Text>
                        </View>
                        <Text style={[Typography.bodySmall, { color: colors.primary, marginTop: 2 }]}>STOK AMAN: <Text style={{ fontWeight: 'bold' }}>{product.safety_stock}</Text> {product.unit}</Text>
                        
                        {!isCompleted && !isShiftReadOnly && !isBlockedByPrevious && (
                          <TouchableOpacity 
                            style={styles.unchangedButton}
                            onPress={() => handleSetUnchanged(product.id)}
                          >
                            <Feather name="copy" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: 'bold' }}>Tidak Ada Pemakaian</Text>
                          </TouchableOpacity>
                        )}
                        
                      </View>
                      
                      <View style={styles.inputSection}>
                        {isCompleted ? (
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[Typography.bodySmall, { color: colors.safe }]}>IN: {existingItems[product.id]?.in ?? 0}</Text>
                            <Text style={[Typography.bodySmall, { color: colors.outOfStock }]}>OUT: {existingItems[product.id]?.out ?? 0}</Text>
                            <Text style={[Typography.cardTitle, { color: colors.primary, marginTop: 4 }]}>SISA: {existingItems[product.id]?.actual ?? 0}</Text>
                          </View>
                        ) : (isShiftReadOnly || isBlockedByPrevious) ? (
                          <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
                            {isBlockedByPrevious ? 'Menunggu shift sblmnya' : 'Belum diisi'}
                          </Text>
                        ) : (
                          <View style={styles.inputWrapper}>
                            <View style={styles.inputBox}>
                              <Text style={[styles.inputLabel, { color: colors.safe }]}>IN</Text>
                              <TextInput
                                value={stockInputs[product.id]?.in || ''}
                                onChangeText={(val) => handleUpdateIn(product.id, val)}
                                keyboardType="decimal-pad"
                                style={[styles.inlineInput, { color: colors.safe, backgroundColor: colors.safe + '10' }]}
                              />
                            </View>
                            <View style={styles.inputBox}>
                              <Text style={[styles.inputLabel, { color: colors.outOfStock }]}>OUT</Text>
                              <TextInput
                                value={stockInputs[product.id]?.out || ''}
                                onChangeText={(val) => handleUpdateOut(product.id, val)}
                                keyboardType="decimal-pad"
                                style={[styles.inlineInput, { color: colors.outOfStock, backgroundColor: colors.outOfStock + '10' }]}
                              />
                            </View>
                            <View style={styles.inputBox}>
                              <Text style={[styles.inputLabel, { color: colors.primary }]}>SISA</Text>
                              <TextInput
                                value={stockInputs[product.id]?.end || ''}
                                onChangeText={(val) => handleUpdateEnd(product.id, val)}
                                keyboardType="decimal-pad"
                                style={[styles.inlineInput, { color: colors.primary, backgroundColor: colors.primary + '10' }]}
                              />
                            </View>
                            {isPoAllowed && (
                              <View style={styles.inputBox}>
                                <Text style={[styles.inputLabel, { color: colors.needPo }]}>PO</Text>
                                <TouchableOpacity
                                  onPress={() => handleTogglePo(product.id)}
                                  style={[
                                    styles.inlineInput, 
                                    { 
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      backgroundColor: stockInputs[product.id]?.po === '1' ? colors.needPo : colors.surfaceElevated, 
                                      borderColor: stockInputs[product.id]?.po === '1' ? colors.needPo : 'transparent',
                                      borderStyle: stockInputs[product.id]?.po === '1' ? 'solid' : 'dashed' 
                                    }
                                  ]}
                                >
                                  {stockInputs[product.id]?.po === '1' && (
                                    <Feather name="check" size={16} color="#FFF" />
                                  )}
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  </AppCard>
                  </FadeInView>
                </View>
              )})}
            </View>
          ))
        )}
      </ScrollView>

      {/* Save Button */}
      {!loading && products.length > 0 && !isCompleted && !isShiftReadOnly && !isBlockedByPrevious && (
        <View style={[styles.bottomBar, { backgroundColor: colors.surface }]}>
          <AppButton title={saving ? 'Menyimpan...' : 'Tutup Shift & Simpan'} onPress={handleAttemptSave} disabled={saving || pendingPOs.length > 0} />
        </View>
      )}

      {/* Floating Alert for Unfilled Items */}
      {unfilledItems.length > 0 && (
        <TouchableOpacity 
          style={{ position: 'absolute', bottom: 100, right: 20, backgroundColor: colors.outOfStock, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 }}
          onPress={scrollToUnfilled}
          activeOpacity={0.8}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 28 }}>!</Text>
        </TouchableOpacity>
      )}

      {/* Validation Modal */}
      <Modal visible={!!selectedPO} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.l }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: Radius.large, padding: Spacing.l }}>
            <Text style={[Typography.screenTitle, { color: colors.textPrimary, marginBottom: Spacing.m }]}>Validasi Penerimaan</Text>
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginBottom: Spacing.l }]}>
              Sesuaikan jumlah fisik barang yang Anda terima. Jika berbeda dengan yang dikirim logistik, silakan ubah angkanya.
            </Text>
            
            <ScrollView style={{ maxHeight: 300 }}>
              {selectedPO?.items.map(item => {
                const prod = products.find(p => p.id === item.product_id);
                const isChecked = checkedItems[item.product_id];
                return (
                  <View key={item.product_id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.m }}>
                    <TouchableOpacity 
                      onPress={() => setCheckedItems(prev => ({ ...prev, [item.product_id]: !prev[item.product_id] }))}
                      style={{ marginRight: Spacing.m, padding: 4 }}
                    >
                      <Feather 
                        name={isChecked ? "check-square" : "square"} 
                        size={24} 
                        color={isChecked ? colors.safe : colors.textSecondary} 
                      />
                    </TouchableOpacity>
                    <View style={{ flex: 1, opacity: isChecked ? 0.5 : 1 }}>
                      <Text style={[Typography.cardTitle, { color: colors.textPrimary, textDecorationLine: isChecked ? 'line-through' : 'none' }]}>{prod?.name}</Text>
                      <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>Dikirim: {item.sent_quantity}</Text>
                    </View>
                    <TextInput
                      value={validationInputs[item.product_id] || ''}
                      onChangeText={(val) => setValidationInputs(prev => ({...prev, [item.product_id]: val}))}
                      keyboardType="decimal-pad"
                      style={[styles.inlineInput, { color: colors.primary, backgroundColor: colors.primary + '10', minWidth: 60 }]}
                    />
                  </View>
                );
              })}
            </ScrollView>
            
            <View style={{ flexDirection: 'row', gap: Spacing.m, marginTop: Spacing.l }}>
              <View style={{ flex: 1 }}>
                <AppButton title="Batal" onPress={() => setSelectedPO(null)} variant="secondary" disabled={validating} />
              </View>
              <View style={{ flex: 1 }}>
                <AppButton title={validating ? 'Loading...' : 'Terima'} onPress={handleValidatePO} disabled={validating} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Validated History Modal */}
      <Modal visible={showHistoryModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: Radius.xlarge, borderTopRightRadius: Radius.xlarge, padding: Spacing.l, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.m }}>
              <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>Riwayat Penerimaan</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Feather name="x" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginBottom: Spacing.l }]}>
              Daftar barang yang sudah Anda validasi hari ini. Anda bisa memastikan apakah jumlahnya sudah sesuai dengan fisik.
            </Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {validatedPOs.map(po => (
                <View key={po.id} style={{ marginBottom: Spacing.l }}>
                  <Text style={[Typography.cardTitle, { color: colors.primary, marginBottom: Spacing.s }]}>PO-{po.id.split('-')[0].toUpperCase()} ({po.type})</Text>
                  <View style={{ backgroundColor: colors.surface, borderRadius: Radius.medium, padding: Spacing.m }}>
                    {po.items.map((item, index) => {
                      const prod = products.find(p => p.id === item.product_id);
                      const isDiscrepancy = item.sent_quantity !== item.validated_quantity;
                      return (
                        <View key={item.product_id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.s, borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.border }}>
                          <Text style={[Typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>{prod?.name}</Text>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>Dikirim: {item.sent_quantity}</Text>
                            <Text style={[Typography.bodyMedium, { color: isDiscrepancy ? colors.outOfStock : colors.safe, fontWeight: 'bold' }]}>Diterima: {item.validated_quantity}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            
            <View style={{ marginTop: Spacing.l }}>
              <AppButton title="Tutup" onPress={() => setShowHistoryModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.l, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.l },
  backButton: { marginRight: Spacing.m },
  shiftSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.s, marginBottom: Spacing.m },
  shiftChip: { flex: 1, minWidth: '20%', paddingVertical: Spacing.m, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  productCard: { marginBottom: Spacing.s, padding: Spacing.m },
  productRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  productInfo: { flex: 1, paddingRight: Spacing.xs },
  unchangedButton: { marginTop: 8, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, borderWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  inputSection: { alignItems: 'flex-end', justifyContent: 'center' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  inputBox: { alignItems: 'center' },
  inputLabel: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  inlineInput: { height: 40, minWidth: 48, paddingHorizontal: 4, textAlign: 'center', fontSize: 14, fontWeight: 'bold', borderWidth: 1, borderColor: 'transparent', borderRadius: 8 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.l, borderTopWidth: 1, borderColor: '#eee', elevation: 10 }
});
