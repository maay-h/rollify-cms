import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Modal } from '../components/ui/Modal.js';
import { LoadingSpinner } from '../components/ui/LoadingSpinner.js';
import { 
  BookOpen, 
  Search, 
  Clock, 
  Layers, 
  ChefHat, 
  Flame, 
  Sparkles, 
  Package, 
  Info 
} from 'lucide-react';
import { clsx } from 'clsx';

interface MenuItemVariant {
  id: string;
  variant_name: string;
  price: string | number;
  is_available: boolean;
}

interface MenuItem {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  description: string;
  price: string;
  tax_rate: string;
  is_veg: boolean;
  is_available: boolean;
  is_chef_special?: boolean;
  is_spicy?: boolean;
  prep_time_minutes: number;
  variants?: MenuItemVariant[];
}

interface RecipeIngredient {
  id: string;
  quantity: string;
  unit: string;
  ingredient_name: string;
  current_stock: string;
  ingredient_unit: string;
}

export const MenuPage: React.FC = () => {
  const { token, hasRole } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);

  // Recipe Modal
  const [inspectItem, setInspectItem] = useState<MenuItem | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeLoading, setRecipeLoading] = useState(false);

  const fetchMenu = async () => {
    try {
      const [catsRes, itemsRes] = await Promise.all([
        fetch('/api/menu/categories', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/menu/items', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const catsJson = await catsRes.json();
      const itemsJson = await itemsRes.json();

      if (catsJson.data) setCategories(catsJson.data);
      if (itemsJson.data) setItems(itemsJson.data);
    } catch (err) {
      toast.error('Failed to load menu data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, [token]);

  const handleInspectRecipe = async (item: MenuItem) => {
    setInspectItem(item);
    setRecipeLoading(true);
    try {
      const res = await fetch(`/api/menu/items/${item.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data && json.data.recipe) {
        setRecipeIngredients(json.data.recipe);
      } else {
        setRecipeIngredients([]);
      }
    } catch (e) {
      toast.error('Failed to load recipe breakdown');
    } finally {
      setRecipeLoading(false);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    const updated = !item.is_available;
    try {
      const res = await fetch(`/api/menu/items/${item.id}/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isAvailable: updated }),
      });
      const json = await res.json();
      if (json.success) {
        toast.info(updated ? `${item.name} is now Available` : `${item.name} marked Out of Stock (86'd)`);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, is_available: updated } : i))
        );
      }
    } catch (e) {
      toast.error('Failed to update availability');
    }
  };

  const filteredItems = items.filter((item) => {
    if (selectedCat !== 'ALL' && item.category_id !== selectedCat) return false;
    if (vegOnly && !item.is_veg) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return <LoadingSpinner text="Loading Rollify menu & recipe catalog..." />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Official Menu Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rollify-gold/15 text-rollify-gold-900 text-xs font-bold mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-rollify-gold-700" />
            <span>Official Rollify Catalog • 15 Categories • 101 Items</span>
          </div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            Menu Catalog & Pricing Matrix
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Exact pricing, regular & large variants, 5% GST and recipe inventory tracking
          </p>
        </div>

        {/* Parcel Charge Tag */}
        <div className="flex items-center gap-2 p-2.5 bg-white border border-stone-200 rounded-2xl shadow-xs text-xs text-stone-600">
          <Package className="w-4 h-4 text-rollify-red shrink-0" />
          <span>Parcel charge: <strong className="text-stone-900 font-mono">₹10/-</strong> per order</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search Chicken Popcorn, Paneer Tikka Roll, Mojitos, Wings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rollify-red"
          />
        </div>

        <button
          onClick={() => setVegOnly(!vegOnly)}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2',
            vegOnly
              ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
              : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
          )}
        >
          <span className="w-3 h-3 rounded-full border border-emerald-600 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          </span>
          Pure Veg Only
        </button>
      </div>

      {/* Category Pills (15 Official Categories) */}
      <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCat('ALL')}
          className={clsx(
            'px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0',
            selectedCat === 'ALL'
              ? 'bg-rollify-red text-white shadow-xs'
              : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
          )}
        >
          All Categories ({items.length})
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCat(c.id)}
            className={clsx(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0',
              selectedCat === c.id
                ? 'bg-rollify-red text-white shadow-xs'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <Card key={item.id} className="p-5 flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      'w-4 h-4 rounded-sm border flex items-center justify-center shrink-0',
                      item.is_veg ? 'border-emerald-600' : 'border-red-600'
                    )}
                  >
                    <span
                      className={clsx(
                        'w-2 h-2 rounded-full',
                        item.is_veg ? 'bg-emerald-600' : 'bg-red-600'
                      )}
                    />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-stone-900 leading-tight">
                      {item.name}
                    </h3>
                  </div>
                </div>

                {/* Price Display */}
                <div className="text-right shrink-0">
                  {item.variants && item.variants.length > 1 ? (
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-stone-400 font-semibold uppercase">Sizes</span>
                      <div className="flex gap-1.5 mt-0.5">
                        {item.variants.map((v) => (
                          <span
                            key={v.id}
                            className="px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-xs font-mono font-bold text-stone-800"
                          >
                            {v.variant_name}: ₹{Number(v.price)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="text-base font-black text-rollify-charcoal font-mono">
                      ₹{Number(item.price).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Special Badges: CHEF SPECIAL / SPICE */}
              <div className="flex items-center gap-1.5 mb-2">
                {item.is_chef_special && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold">
                    <ChefHat className="w-3 h-3 text-rollify-gold-700" />
                    CHEF SPECIAL
                  </span>
                )}
                {item.is_spicy && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 text-[10px] font-bold">
                    <Flame className="w-3 h-3 text-rose-600" />
                    SPICE
                  </span>
                )}
              </div>

              <p className="text-xs text-stone-500 line-clamp-2 mb-3">
                {item.description}
              </p>

              <div className="flex items-center gap-3 text-[11px] text-stone-500 font-medium">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  {item.prep_time_minutes} mins
                </span>
                <span>•</span>
                <span>{item.tax_rate}% GST</span>
                <span>•</span>
                <span className="text-stone-400">{item.category_name}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-stone-100">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1.5"
                onClick={() => handleInspectRecipe(item)}
                leftIcon={<Layers className="w-3.5 h-3.5" />}
              >
                Recipe Ingredients
              </Button>

              {hasRole('ADMIN', 'MANAGER', 'KITCHEN') && (
                <Button
                  variant={item.is_available ? 'outline' : 'gold'}
                  size="sm"
                  className={clsx(
                    'text-xs h-8',
                    !item.is_available && 'bg-rose-50 border-rose-300 text-rose-700'
                  )}
                  onClick={() => toggleAvailability(item)}
                >
                  {item.is_available ? 'Available' : '86’d (Out of Stock)'}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Recipe Inspection Modal */}
      <Modal
        isOpen={Boolean(inspectItem)}
        onClose={() => setInspectItem(null)}
        title={
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-rollify-red" />
            <span>Recipe Formula: {inspectItem?.name}</span>
          </div>
        }
        maxWidth="lg"
      >
        {recipeLoading ? (
          <LoadingSpinner text="Loading ingredient formula..." />
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-stone-600">
              When prepared in an order, the following exact ingredient quantities are automatically deducted from the stock ledger:
            </p>

            {recipeIngredients.length === 0 ? (
              <div className="p-4 bg-amber-50 rounded-2xl text-xs text-amber-800 border border-amber-200">
                Packaged / beverage item. Inventory is tracked directly by whole unit count.
              </div>
            ) : (
              <div className="overflow-hidden border border-stone-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Ingredient</th>
                      <th className="py-2.5 px-3">Consumption per Order</th>
                      <th className="py-2.5 px-3">Current Inventory</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {recipeIngredients.map((ing) => (
                      <tr key={ing.id} className="hover:bg-stone-50/50">
                        <td className="py-2.5 px-3 font-semibold text-stone-900">
                          {ing.ingredient_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-rollify-red">
                          {Number(ing.quantity)} {ing.unit}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-stone-600">
                          {Number(ing.current_stock).toFixed(2)} {ing.ingredient_unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="charcoal" size="sm" onClick={() => setInspectItem(null)}>
                Close Formula
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
