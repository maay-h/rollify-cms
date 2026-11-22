import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useSocket } from '../context/SocketContext.js';
import { useToast } from '../context/ToastContext.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge, BadgeVariant } from '../components/ui/Badge.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { 
  PackageSearch, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Plus, 
  RotateCcw, 
  Trash2, 
  ClipboardList, 
  Search, 
  DollarSign, 
  CheckCircle2, 
  FileSpreadsheet, 
  BookOpen,
  Scale
} from 'lucide-react';
import { clsx } from 'clsx';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_stock: string | number;
  min_threshold: string | number;
  cost_per_unit: string | number;
  stock_valuation: string | number;
  stock_status: 'OPTIMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  is_active: boolean;
}

interface StockMovement {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  movement_type: 'PURCHASE' | 'CONSUMPTION' | 'WASTAGE' | 'ADJUSTMENT' | 'REVERSAL';
  quantity: string | number;
  balance_after: string | number;
  reference_id: string;
  notes: string;
  created_by_name?: string;
  created_by_role?: string;
  created_at: string;
}

interface RecipeItem {
  menu_item_id: string;
  item_name: string;
  category_name: string;
  total_recipe_cost: number;
  ingredients: Array<{
    recipe_id: string;
    ingredient_id: string;
    ingredient_name: string;
    quantity: number;
    unit: string;
    ingredient_cost: number;
  }>;
}

export const InventoryPage: React.FC = () => {
  const { token, hasRole } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'ingredients' | 'ledger' | 'recipes'>('ingredients');

  // Ingredients state
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [summary, setSummary] = useState({
    totalIngredients: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalValuation: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Ledger state
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>('ALL');

  // Recipes state
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);

  // Modals state
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [isWastageOpen, setIsWastageOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isNewIngredientOpen, setIsNewIngredientOpen] = useState(false);

  // Modal Form inputs
  const [restockQty, setRestockQty] = useState('');
  const [restockCost, setRestockCost] = useState('');
  const [restockRef, setRestockRef] = useState('');
  const [restockNotes, setRestockNotes] = useState('');

  const [wastageQty, setWastageQty] = useState('');
  const [wastageReason, setWastageReason] = useState('Prep Spoilage');

  const [reconcileCount, setReconcileCount] = useState('');
  const [reconcileReason, setReconcileReason] = useState('Weekly Stock Audit');

  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState<'kg' | 'g' | 'l' | 'ml' | 'pcs' | 'portion'>('kg');
  const [newInitialStock, setNewInitialStock] = useState('10');
  const [newMinThreshold, setNewMinThreshold] = useState('3');
  const [newCostPerUnit, setNewCostPerUnit] = useState('100');

  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch Ingredients
  const fetchIngredients = async () => {
    try {
      const query = filterLowStockOnly ? '?lowStockOnly=true' : '';
      const res = await fetch(`/api/inventory/ingredients${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setIngredients(json.data);
        if (json.summary) setSummary(json.summary);
      }
    } catch (e) {
      toast.error('Failed to load ingredients data');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Ledger
  const fetchLedger = async () => {
    setLedgerLoading(true);
    try {
      let url = '/api/inventory/ledger?limit=100';
      if (ledgerTypeFilter !== 'ALL') {
        url += `&movementType=${ledgerTypeFilter}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setMovements(json.data);
      }
    } catch (e) {
      toast.error('Failed to load stock movements');
    } finally {
      setLedgerLoading(false);
    }
  };

  // 3. Fetch Recipes
  const fetchRecipes = async () => {
    setRecipesLoading(true);
    try {
      const res = await fetch('/api/inventory/recipes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setRecipes(json.data);
      }
    } catch (e) {
      toast.error('Failed to load recipe formulas');
    } finally {
      setRecipesLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
  }, [filterLowStockOnly]);

  useEffect(() => {
    if (activeTab === 'ledger') fetchLedger();
    if (activeTab === 'recipes') fetchRecipes();
  }, [activeTab, ledgerTypeFilter]);

  // Real-time socket updates
  useEffect(() => {
    if (!socket) return;

    const handleStockUpdate = () => {
      fetchIngredients();
      if (activeTab === 'ledger') fetchLedger();
    };

    const handleLowStockAlert = (alertData: any) => {
      toast.warning(`Low Stock Alert: ${alertData.name} (${alertData.currentStock} ${alertData.unit} left)`);
      fetchIngredients();
    };

    socket.on('inventory:stock_updated', handleStockUpdate);
    socket.on('inventory:low_stock', handleLowStockAlert);

    return () => {
      socket.off('inventory:stock_updated', handleStockUpdate);
      socket.off('inventory:low_stock', handleLowStockAlert);
    };
  }, [socket, activeTab]);

  // Form Submissions
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient) return;
    const qty = parseFloat(restockQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid positive quantity');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ingredientId: selectedIngredient.id,
          quantity: qty,
          costPerUnit: restockCost ? parseFloat(restockCost) : undefined,
          reference: restockRef || 'RESTOCK-MANUAL',
          notes: restockNotes || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Successfully restocked ${qty} ${selectedIngredient.unit} of ${selectedIngredient.name}`);
        setIsRestockOpen(false);
        setRestockQty('');
        setRestockCost('');
        setRestockRef('');
        setRestockNotes('');
        fetchIngredients();
      } else {
        toast.error(json.error || 'Failed to restock');
      }
    } catch (err) {
      toast.error('Network error while restocking');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWastageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient) return;
    const qty = parseFloat(wastageQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid positive wastage quantity');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/inventory/wastage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ingredientId: selectedIngredient.id,
          quantity: qty,
          reason: wastageReason,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.warning(`Recorded wastage of ${qty} ${selectedIngredient.unit} for ${selectedIngredient.name}`);
        setIsWastageOpen(false);
        setWastageQty('');
        fetchIngredients();
      } else {
        toast.error(json.error || 'Failed to record wastage');
      }
    } catch (err) {
      toast.error('Network error recording wastage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient) return;
    const count = parseFloat(reconcileCount);
    if (isNaN(count) || count < 0) {
      toast.error('Please enter a valid count (>= 0)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/inventory/reconcile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ingredientId: selectedIngredient.id,
          actualCount: count,
          reason: reconcileReason,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Inventory reconciled: stock updated to ${count} ${selectedIngredient.unit}`);
        setIsReconcileOpen(false);
        setReconcileCount('');
        fetchIngredients();
      } else {
        toast.error(json.error || 'Failed to reconcile');
      }
    } catch (err) {
      toast.error('Network error during reconciliation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName) {
      toast.error('ID and Name are required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/inventory/ingredients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: newId.trim().toLowerCase().startsWith('ing-') ? newId.trim().toLowerCase() : `ing-${newId.trim().toLowerCase()}`,
          name: newName.trim(),
          unit: newUnit,
          initialStock: parseFloat(newInitialStock) || 0,
          minThreshold: parseFloat(newMinThreshold) || 5,
          costPerUnit: parseFloat(newCostPerUnit) || 0,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Ingredient '${newName}' created successfully`);
        setIsNewIngredientOpen(false);
        setNewId('');
        setNewName('');
        fetchIngredients();
      } else {
        toast.error(json.error || 'Failed to create ingredient');
      }
    } catch (err) {
      toast.error('Network error creating ingredient');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredIngredients = ingredients.filter((ing) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return ing.name.toLowerCase().includes(q) || ing.id.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rollify-red-50 text-rollify-red rounded-xl">
              <PackageSearch className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900">Inventory & Recipe Consumption</h1>
              <p className="text-xs text-stone-500">
                Recipe-based ingredient ledger, real-time kitchen deductions, wastage, and restocking
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasRole('ADMIN', 'MANAGER') && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsNewIngredientOpen(true)}
            >
              Add Raw Ingredient
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-stone-200/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Total Ingredients</p>
              <p className="text-2xl font-bold text-stone-900 mt-1">{summary.totalIngredients}</p>
            </div>
            <div className="p-3 bg-stone-100 rounded-xl text-stone-600">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">Active raw materials in stock</p>
        </Card>

        <Card className="p-4 bg-white border border-stone-200/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Stock Valuation</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">₹{summary.totalValuation.toLocaleString('en-IN')}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">Current inventory cost value</p>
        </Card>

        <Card
          className={clsx(
            'p-4 border transition-all cursor-pointer',
            summary.lowStockCount > 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-stone-200/80'
          )}
          onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Low Stock Alerts</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">{summary.lowStockCount}</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-xl text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-amber-800 font-medium mt-2">
            {filterLowStockOnly ? '✓ Filtering low stock only' : 'Click to filter low stock items'}
          </p>
        </Card>

        <Card className="p-4 bg-white border border-stone-200/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Out of Stock</p>
              <p className={clsx('text-2xl font-bold mt-1', summary.outOfStockCount > 0 ? 'text-red-600' : 'text-stone-900')}>
                {summary.outOfStockCount}
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl text-red-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">Ingredients requiring immediate purchase</p>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
        <button
          onClick={() => setActiveTab('ingredients')}
          className={clsx(
            'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
            activeTab === 'ingredients'
              ? 'bg-rollify-red text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          )}
        >
          <PackageSearch className="w-4 h-4" />
          Raw Ingredients ({ingredients.length})
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={clsx(
            'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
            activeTab === 'ledger'
              ? 'bg-rollify-red text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          )}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Stock Movement Ledger
        </button>

        <button
          onClick={() => setActiveTab('recipes')}
          className={clsx(
            'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
            activeTab === 'recipes'
              ? 'bg-rollify-red text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          )}
        >
          <BookOpen className="w-4 h-4" />
          Recipe Formulations ({recipes.length})
        </button>
      </div>

      {/* TAB 1: RAW INGREDIENTS TABLE */}
      {activeTab === 'ingredients' && (
        <Card className="p-4 bg-white border border-stone-200/80">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search raw ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rollify-red/20 focus:border-rollify-red"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={filterLowStockOnly ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
              >
                {filterLowStockOnly ? 'Show All Ingredients' : 'Filter Low Stock (< Threshold)'}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner text="Loading inventory records..." />
            </div>
          ) : filteredIngredients.length === 0 ? (
            <EmptyState
              title="No ingredients found"
              description="No raw ingredients matched your search criteria."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-600">
                <thead className="bg-stone-50 uppercase text-[10px] tracking-wider text-stone-500 font-bold border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4">Ingredient Name</th>
                    <th className="py-3 px-3">Unit</th>
                    <th className="py-3 px-3">Current Stock</th>
                    <th className="py-3 px-3">Min Threshold</th>
                    <th className="py-3 px-3">Unit Cost</th>
                    <th className="py-3 px-3">Valuation</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {filteredIngredients.map((ing) => {
                    const stock = Number(ing.current_stock);
                    const threshold = Number(ing.min_threshold);
                    const cost = Number(ing.cost_per_unit);
                    const val = Number(ing.stock_valuation);

                    let statusVariant: BadgeVariant = 'success';
                    let statusText = 'Optimal';

                    if (stock <= 0) {
                      statusVariant = 'danger';
                      statusText = 'Out of Stock';
                    } else if (stock <= threshold) {
                      statusVariant = 'warning';
                      statusText = 'Low Stock';
                    }

                    return (
                      <tr key={ing.id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-stone-900">
                          <div>
                            <span>{ing.name}</span>
                            <span className="block text-[10px] text-stone-400 font-mono">{ing.id}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 bg-stone-100 rounded text-stone-600 font-mono text-[11px]">
                            {ing.unit}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={clsx('text-sm font-bold', stock <= threshold ? 'text-amber-700' : 'text-stone-900')}>
                            {stock.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-stone-500">
                          {threshold.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-3 text-stone-700 font-mono">
                          ₹{cost.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-emerald-800 font-mono">
                          ₹{val.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-3">
                          <Badge variant={statusVariant}>{statusText}</Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              title="Restock / Purchase Inflow"
                              onClick={() => {
                                setSelectedIngredient(ing);
                                setRestockCost(String(ing.cost_per_unit));
                                setIsRestockOpen(true);
                              }}
                              className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span>Restock</span>
                            </button>

                            <button
                              title="Record Kitchen Spoilage / Wastage"
                              onClick={() => {
                                setSelectedIngredient(ing);
                                setIsWastageOpen(true);
                              }}
                              className="p-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Wastage</span>
                            </button>

                            {hasRole('ADMIN', 'MANAGER') && (
                              <button
                                title="Physical Count Reconciliation"
                                onClick={() => {
                                  setSelectedIngredient(ing);
                                  setReconcileCount(String(ing.current_stock));
                                  setIsReconcileOpen(true);
                                }}
                                className="p-1.5 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              >
                                <Scale className="w-3.5 h-3.5" />
                                <span>Audit</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: STOCK MOVEMENT LEDGER */}
      {activeTab === 'ledger' && (
        <Card className="p-4 bg-white border border-stone-200/80">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Live Stock Movement Ledger</h2>
              <p className="text-xs text-stone-400">Complete immutable audit trail of consumption, restocks and wastage</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500 font-medium">Filter Type:</span>
              <select
                value={ledgerTypeFilter}
                onChange={(e) => setLedgerTypeFilter(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rollify-red/20"
              >
                <option value="ALL">All Movements</option>
                <option value="CONSUMPTION">Orders (CONSUMPTION)</option>
                <option value="PURCHASE">Restocks (PURCHASE)</option>
                <option value="WASTAGE">Wastage (WASTAGE)</option>
                <option value="REVERSAL">Reversals (REVERSAL)</option>
                <option value="ADJUSTMENT">Reconciliations (ADJUSTMENT)</option>
              </select>
              <Button size="sm" variant="outline" onClick={fetchLedger}>
                Refresh
              </Button>
            </div>
          </div>

          {ledgerLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner text="Fetching ledger records..." />
            </div>
          ) : movements.length === 0 ? (
            <EmptyState
              title="No movements recorded"
              description="No stock movement transactions recorded yet."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-600">
                <thead className="bg-stone-50 uppercase text-[10px] tracking-wider text-stone-500 font-bold border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-4">Ingredient</th>
                    <th className="py-3 px-3">Quantity</th>
                    <th className="py-3 px-3">Balance After</th>
                    <th className="py-3 px-4">Notes / Reference</th>
                    <th className="py-3 px-3">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {movements.map((m) => {
                    const qty = Number(m.quantity);
                    let badgeVariant: BadgeVariant = 'default';
                    if (m.movement_type === 'PURCHASE' || m.movement_type === 'REVERSAL') badgeVariant = 'success';
                    if (m.movement_type === 'CONSUMPTION') badgeVariant = 'default';
                    if (m.movement_type === 'WASTAGE') badgeVariant = 'danger';
                    if (m.movement_type === 'ADJUSTMENT') badgeVariant = 'warning';

                    return (
                      <tr key={m.id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-3 px-4 text-stone-500 font-mono text-[11px]">
                          {new Date(m.created_at).toLocaleString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={badgeVariant}>{m.movement_type}</Badge>
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-900">
                          {m.ingredient_name}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold">
                          <span className={qty > 0 ? 'text-emerald-700' : 'text-red-700'}>
                            {qty > 0 ? `+${qty}` : qty} {m.ingredient_unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-stone-700">
                          {Number(m.balance_after).toFixed(2)} {m.ingredient_unit}
                        </td>
                        <td className="py-3 px-4 text-stone-600 max-w-xs truncate" title={m.notes}>
                          <span className="font-semibold text-stone-800">{m.reference_id}:</span> {m.notes}
                        </td>
                        <td className="py-3 px-3 text-stone-500 text-[11px]">
                          {m.created_by_name || 'System / Auto'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: RECIPE FORMULATIONS */}
      {activeTab === 'recipes' && (
        <div className="space-y-4">
          <Card className="p-4 bg-white border border-stone-200/80">
            <h2 className="text-sm font-bold text-stone-900">Standardized Recipe Formulations</h2>
            <p className="text-xs text-stone-400">
              Configured ingredient quantities consumed automatically whenever kitchen prepares each Rollify dish
            </p>
          </Card>

          {recipesLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner text="Loading menu recipes..." />
            </div>
          ) : recipes.length === 0 ? (
            <EmptyState
              title="No recipe mappings found"
              description="No menu items currently have ingredient recipe formulas attached."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipes.map((r) => (
                <Card key={r.menu_item_id} className="p-4 bg-white border border-stone-200/80 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-rollify-red bg-rollify-red-50 px-2 py-0.5 rounded-full">
                          {r.category_name}
                        </span>
                        <h3 className="text-sm font-bold text-stone-900 mt-1">{r.item_name}</h3>
                      </div>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 font-mono">
                        Cost: ₹{r.total_recipe_cost.toFixed(2)}
                      </span>
                    </div>

                    <div className="mt-3 divide-y divide-stone-100 border-t border-stone-100 pt-2 text-xs">
                      {r.ingredients.map((ing) => (
                        <div key={ing.ingredient_id} className="py-1.5 flex items-center justify-between text-stone-600">
                          <span className="font-medium text-stone-800">{ing.ingredient_name}</span>
                          <span className="font-mono text-stone-500">
                            {ing.quantity} {ing.unit} (~₹{ing.ingredient_cost.toFixed(2)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-[10px] text-stone-400 mt-4 pt-2 border-t border-stone-100">
                    * Large variants (LRG) automatically scale portion requirement by 1.5x
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: RESTOCK / INFLOW */}
      <Modal
        isOpen={isRestockOpen}
        onClose={() => setIsRestockOpen(false)}
        title={`Restock ${selectedIngredient?.name || 'Ingredient'}`}
      >
        <form onSubmit={handleRestockSubmit} className="space-y-4">
          <p className="text-xs text-stone-500">
            Current Stock: <strong className="text-stone-800">{selectedIngredient?.current_stock} {selectedIngredient?.unit}</strong>
          </p>

          <Input
            label={`Quantity to Add (${selectedIngredient?.unit})`}
            type="number"
            step="any"
            placeholder="e.g. 20"
            value={restockQty}
            onChange={(e) => setRestockQty(e.target.value)}
            required
            autoFocus
          />

          <Input
            label={`Unit Cost (₹ per ${selectedIngredient?.unit})`}
            type="number"
            step="any"
            placeholder="Cost per unit"
            value={restockCost}
            onChange={(e) => setRestockCost(e.target.value)}
          />

          <Input
            label="Invoice / Supplier Reference"
            placeholder="e.g. INV-POULTRY-9921"
            value={restockRef}
            onChange={(e) => setRestockRef(e.target.value)}
          />

          <Input
            label="Notes"
            placeholder="Optional delivery or batch notes"
            value={restockNotes}
            onChange={(e) => setRestockNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsRestockOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting}>
              Confirm Restock
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: RECORD WASTAGE */}
      <Modal
        isOpen={isWastageOpen}
        onClose={() => setIsWastageOpen(false)}
        title={`Record Wastage - ${selectedIngredient?.name || 'Ingredient'}`}
      >
        <form onSubmit={handleWastageSubmit} className="space-y-4">
          <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs">
            Wastage reduces raw inventory without generating sales revenue. It will be recorded in the kitchen audit ledger.
          </div>

          <Input
            label={`Wastage Quantity (${selectedIngredient?.unit})`}
            type="number"
            step="any"
            placeholder="e.g. 1.5"
            value={wastageQty}
            onChange={(e) => setWastageQty(e.target.value)}
            required
            autoFocus
          />

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Reason for Wastage</label>
            <select
              value={wastageReason}
              onChange={(e) => setWastageReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rollify-red/20"
            >
              <option value="Prep Spoilage">Prep Spoilage / Trimmings</option>
              <option value="Overcooked / Burnt">Overcooked / Burnt Food</option>
              <option value="Dropped / Spilled">Dropped / Physical Spillage</option>
              <option value="Freezer Temperature Anomaly">Freezer Temperature Anomaly</option>
              <option value="Expired Shelf Life">Expired Shelf Life</option>
              <option value="Customer Return (Discarded)">Customer Return (Discarded)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsWastageOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting}>
              Record Wastage
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: AUDIT RECONCILIATION */}
      <Modal
        isOpen={isReconcileOpen}
        onClose={() => setIsReconcileOpen(false)}
        title={`Stock Take Audit - ${selectedIngredient?.name || 'Ingredient'}`}
      >
        <form onSubmit={handleReconcileSubmit} className="space-y-4">
          <p className="text-xs text-stone-500">
            System Recorded Stock: <strong className="text-stone-800">{selectedIngredient?.current_stock} {selectedIngredient?.unit}</strong>
          </p>

          <Input
            label={`Actual Physical Count (${selectedIngredient?.unit})`}
            type="number"
            step="any"
            placeholder="Counted quantity on shelf"
            value={reconcileCount}
            onChange={(e) => setReconcileCount(e.target.value)}
            required
            autoFocus
          />

          {reconcileCount && !isNaN(parseFloat(reconcileCount)) && (
            <div className="p-3 bg-stone-50 rounded-xl text-xs font-medium">
              Variance:{' '}
              <span className={parseFloat(reconcileCount) >= Number(selectedIngredient?.current_stock) ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                {(parseFloat(reconcileCount) - Number(selectedIngredient?.current_stock)).toFixed(2)} {selectedIngredient?.unit}
              </span>
            </div>
          )}

          <Input
            label="Audit Notes / Reason"
            value={reconcileReason}
            onChange={(e) => setReconcileReason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsReconcileOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting}>
              Apply Count Adjustment
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: NEW INGREDIENT */}
      <Modal
        isOpen={isNewIngredientOpen}
        onClose={() => setIsNewIngredientOpen(false)}
        title="Add New Raw Ingredient"
      >
        <form onSubmit={handleCreateIngredient} className="space-y-3">
          <Input
            label="Ingredient Code / ID"
            placeholder="e.g. ing-sauce-chipotle"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            required
          />

          <Input
            label="Ingredient Display Name"
            placeholder="e.g. Smoked Chipotle Mayo"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Stock Unit</label>
            <select
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rollify-red/20"
            >
              <option value="kg">kg (Kilograms)</option>
              <option value="g">g (Grams)</option>
              <option value="l">l (Litres)</option>
              <option value="ml">ml (Millilitres)</option>
              <option value="pcs">pcs (Pieces / Buns / Wraps)</option>
              <option value="portion">portion (Pre-portioned servings)</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input
              label="Opening Stock"
              type="number"
              step="any"
              value={newInitialStock}
              onChange={(e) => setNewInitialStock(e.target.value)}
            />
            <Input
              label="Low Threshold"
              type="number"
              step="any"
              value={newMinThreshold}
              onChange={(e) => setNewMinThreshold(e.target.value)}
            />
            <Input
              label="Cost per Unit (₹)"
              type="number"
              step="any"
              value={newCostPerUnit}
              onChange={(e) => setNewCostPerUnit(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsNewIngredientOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submitting}>
              Create Ingredient
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
