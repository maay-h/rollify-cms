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
  Info,
  UtensilsCrossed,
  Plus,
  Pencil,
  Trash2,
  Check,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { DEMO_CATEGORIES, DEMO_MENU_ITEMS } from '../mock/demoStore.js';

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

  // Alteration / Add Item Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formNewCategoryName, setFormNewCategoryName] = useState('');
  const [isCreatingNewCat, setIsCreatingNewCat] = useState(false);
  const [formPrice, setFormPrice] = useState<number | string>(120);
  const [formDescription, setFormDescription] = useState('');
  const [formIsVeg, setFormIsVeg] = useState(true);
  const [formIsChefSpecial, setFormIsChefSpecial] = useState(false);
  const [formIsSpicy, setFormIsSpicy] = useState(false);
  const [formPrepTime, setFormPrepTime] = useState(10);
  const [formIsAvailable, setFormIsAvailable] = useState(true);
  const [formHasVariants, setFormHasVariants] = useState(false);
  const [formVariants, setFormVariants] = useState<{ id?: string; variantName: string; price: number | string }[]>([
    { variantName: 'Regular', price: 120 },
    { variantName: 'Large', price: 160 },
  ]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormCategoryId(categories[0]?.id || 'cat-rolls-01');
    setFormNewCategoryName('');
    setIsCreatingNewCat(false);
    setFormPrice(120);
    setFormDescription('');
    setFormIsVeg(true);
    setFormIsChefSpecial(false);
    setFormIsSpicy(false);
    setFormPrepTime(10);
    setFormIsAvailable(true);
    setFormHasVariants(false);
    setFormVariants([
      { variantName: 'Regular', price: 120 },
      { variantName: 'Large', price: 160 },
    ]);
    setIsEditModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategoryId(item.category_id);
    setFormNewCategoryName('');
    setIsCreatingNewCat(false);
    setFormPrice(Number(item.price) || 0);
    setFormDescription(item.description || '');
    setFormIsVeg(item.is_veg);
    setFormIsChefSpecial(Boolean(item.is_chef_special));
    setFormIsSpicy(Boolean(item.is_spicy));
    setFormPrepTime(item.prep_time_minutes || 10);
    setFormIsAvailable(item.is_available);

    if (item.variants && item.variants.length > 0) {
      setFormHasVariants(true);
      setFormVariants(item.variants.map((v) => ({ id: v.id, variantName: v.variant_name, price: Number(v.price) })));
    } else {
      setFormHasVariants(false);
      setFormVariants([
        { variantName: 'Regular', price: Number(item.price) || 120 },
        { variantName: 'Large', price: Math.round(Number(item.price) * 1.3) || 160 },
      ]);
    }
    setIsEditModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Validation Error', 'Item name is required');
      return;
    }

    setIsSaving(true);
    try {
      let finalCategoryId = formCategoryId;

      // Handle new category creation
      if (isCreatingNewCat && formNewCategoryName.trim()) {
        const catRes = await fetch('/api/menu/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: formNewCategoryName.trim() }),
        });
        const catJson = await catRes.json();
        if (catJson.success && catJson.data) {
          finalCategoryId = catJson.data.id;
          setCategories((prev) => [...prev, catJson.data]);
        }
      }

      const payload = {
        name: formName.trim(),
        categoryId: finalCategoryId,
        description: formDescription.trim(),
        price: Number(formPrice) || 0,
        isVeg: formIsVeg,
        isChefSpecial: formIsChefSpecial,
        isSpicy: formIsSpicy,
        prepTimeMinutes: Number(formPrepTime) || 10,
        isAvailable: formIsAvailable,
        variants: formHasVariants
          ? formVariants.filter((v) => v.variantName.trim()).map((v) => ({
              id: v.id,
              variantName: v.variantName.trim(),
              price: Number(v.price) || 0,
            }))
          : [],
      };

      if (editingItem) {
        const res = await fetch(`/api/menu/items/${editingItem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success && json.data) {
          setItems((prev) =>
            prev.map((it) => (it.id === editingItem.id ? { ...it, ...json.data } : it))
          );
          toast.success('Menu Item Altered', `"${formName}" updated successfully`);
          setIsEditModalOpen(false);
        } else {
          toast.error('Alteration Failed', json.error || 'Could not update item');
        }
      } else {
        const res = await fetch('/api/menu/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success && json.data) {
          setItems((prev) => [json.data, ...prev]);
          toast.success('New Item Added', `"${formName}" added to the menu`);
          setIsEditModalOpen(false);
        } else {
          toast.error('Creation Failed', json.error || 'Could not create item');
        }
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'Operation failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (item: MenuItem) => {
    if (!window.confirm(`Are you sure you want to remove "${item.name}" from the active menu catalog?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/menu/items/${item.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (json.success) {
        setItems((prev) => prev.filter((it) => it.id !== item.id));
        toast.info('Item Removed', `"${item.name}" was removed from the menu.`);
      } else {
        toast.error('Delete Failed', json.error || 'Could not delete item');
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    }
  };

  const fetchMenu = async () => {
    try {
      const [catsRes, itemsRes] = await Promise.all([
        fetch('/api/menu/categories', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/menu/items', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const catsJson = await catsRes.json();
      const itemsJson = await itemsRes.json();

      if (catsJson && Array.isArray(catsJson.data) && catsJson.data.length > 0) {
        setCategories(catsJson.data);
      } else {
        setCategories(DEMO_CATEGORIES);
      }

      if (itemsJson && Array.isArray(itemsJson.data) && itemsJson.data.length > 0) {
        setItems(itemsJson.data);
      } else {
        setItems(DEMO_MENU_ITEMS);
      }
    } catch (err) {
      setCategories(DEMO_CATEGORIES);
      setItems(DEMO_MENU_ITEMS);
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
    return <LoadingSpinner text="Loading menu & recipe catalog..." />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Official Menu Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rollify-gold/15 text-rollify-gold-900 text-xs font-bold mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-rollify-gold-700" />
            <span>Official Menu Catalog • 15 Categories • 101 Items</span>
          </div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            Menu Catalog & Pricing Matrix
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Exact pricing, regular & large variants, 5% GST and recipe inventory tracking
          </p>
        </div>

        {/* Actions: Parcel Tag & Add Item Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 p-2.5 bg-white border border-stone-200 rounded-2xl shadow-xs text-xs text-stone-600">
            <Package className="w-4 h-4 text-rollify-red shrink-0" />
            <span>Parcel charge: <strong className="text-stone-900 font-mono">₹10/-</strong></span>
          </div>

          {hasRole('ADMIN', 'MANAGER') && (
            <Button
              variant="primary"
              size="md"
              onClick={openCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Menu Item
            </Button>
          )}
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
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-stone-200 p-8 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mb-3">
              <UtensilsCrossed className="w-8 h-8 text-[#C8102E]" />
            </div>
            <h3 className="text-base font-bold text-stone-900 mb-1">No menu items match the filter</h3>
            <p className="text-xs text-stone-500 max-w-sm mb-4">
              Try selecting another category or clearing search filters to browse our fresh rolls, coffee, tea, beverages, snacks, burgers & desserts.
            </p>
            <button
              onClick={() => {
                setSelectedCat('ALL');
                setSearch('');
                setVegOnly(false);
              }}
              className="px-5 py-2 bg-[#C8102E] hover:bg-[#A80D26] text-white text-xs font-bold rounded-xl transition shadow-xs"
            >
              Show All Menu Items ({items.length})
            </button>
          </div>
        ) : (
          filteredItems.map((item) => (
          <Card key={item.id} className="p-5 flex flex-col justify-between hover:shadow-md transition min-h-[160px]">
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

            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mt-3 border-t border-stone-100">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1"
                  onClick={() => handleInspectRecipe(item)}
                  title="View Ingredient Deductions"
                >
                  <Layers className="w-3.5 h-3.5 text-stone-500" />
                  <span className="hidden sm:inline">Recipe</span>
                </Button>

                {hasRole('ADMIN', 'MANAGER') && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 px-2.5 gap-1 text-stone-700 hover:text-stone-900 border-stone-200"
                      onClick={() => openEditModal(item)}
                      title="Alter Dish Details & Pricing"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#F59E0B]" />
                      <span>Alter</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                      onClick={() => handleDeleteItem(item)}
                      title="Delete / Archive Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>

              {hasRole('ADMIN', 'KITCHEN') && (
                <Button
                  variant={item.is_available ? 'outline' : 'gold'}
                  size="sm"
                  className={clsx(
                    'text-xs h-8',
                    !item.is_available && 'bg-rose-50 border-rose-300 text-rose-700'
                  )}
                  onClick={() => toggleAvailability(item)}
                >
                  {item.is_available ? 'In Stock' : '86’d'}
                </Button>
              )}
            </div>
          </Card>
        ))
      )}
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

      {/* Menu Item Alteration & Add Item Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsEditModalOpen(false)}
          maxWidth="lg"
          title={
            <div className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-[#C8102E]" />
              <span>{editingItem ? `Alter Menu Item: ${editingItem.name}` : 'Add New Menu Item'}</span>
            </div>
          }
        >
          <form onSubmit={handleSaveItem} className="space-y-4 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Item Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-700">
                  Item / Dish Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Crispy Paneer Tikka Roll"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-stone-700">
                    Category *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewCat(!isCreatingNewCat)}
                    className="text-[10px] font-bold text-[#C8102E] hover:underline"
                  >
                    {isCreatingNewCat ? 'Choose Existing' : '+ New Category'}
                  </button>
                </div>
                {isCreatingNewCat ? (
                  <input
                    type="text"
                    placeholder="e.g. Signature Mocktails"
                    value={formNewCategoryName}
                    onChange={(e) => setFormNewCategoryName(e.target.value)}
                    className="w-full px-3 py-2 bg-amber-50 border border-amber-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  />
                ) : (
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Base Price & Prep Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-700">
                  Base Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  placeholder="e.g. 149"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-700">
                  Est. Kitchen Prep Time (Mins)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={formPrepTime}
                  onChange={(e) => setFormPrepTime(Number(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                />
              </div>
            </div>

            {/* Variants Toggle & Editor */}
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-stone-800">
                  <input
                    type="checkbox"
                    checked={formHasVariants}
                    onChange={(e) => setFormHasVariants(e.target.checked)}
                    className="w-4 h-4 rounded text-[#C8102E] accent-[#C8102E]"
                  />
                  <span>Has multiple portion sizes? (e.g. Regular & Large)</span>
                </label>

                {formHasVariants && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormVariants((prev) => [
                        ...prev,
                        { variantName: 'Portion ' + (prev.length + 1), price: formPrice },
                      ])
                    }
                    className="text-[10px] font-bold text-[#C8102E] hover:underline"
                  >
                    + Add Size Variant
                  </button>
                )}
              </div>

              {formHasVariants && (
                <div className="space-y-1.5 pt-1">
                  {formVariants.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Size (e.g. REG, LRG)"
                        value={v.variantName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariants((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, variantName: val } : item))
                          );
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                      />
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1.5 text-xs text-stone-400">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={v.price}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormVariants((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, price: val } : item))
                            );
                          }}
                          className="w-full pl-6 pr-2 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                        />
                      </div>
                      {formVariants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormVariants((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-stone-400 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Food Type (Veg / Non-Veg) & Badges */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700">Food Type & Badges</label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormIsVeg(true)}
                  className={clsx(
                    'px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer',
                    formIsVeg
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                      : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  Pure Veg
                </button>
                <button
                  type="button"
                  onClick={() => setFormIsVeg(false)}
                  className={clsx(
                    'px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer',
                    !formIsVeg
                      ? 'bg-rose-50 border-rose-400 text-rose-800'
                      : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  Non-Veg
                </button>

                <label className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition flex items-center gap-1.5 select-none',
                  formIsChefSpecial
                    ? 'bg-amber-100 border-amber-400 text-amber-900'
                    : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                )}>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={formIsChefSpecial}
                    onChange={(e) => setFormIsChefSpecial(e.target.checked)}
                  />
                  <ChefHat className="w-3.5 h-3.5 text-amber-700" />
                  Chef's Special
                </label>

                <label className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition flex items-center gap-1.5 select-none',
                  formIsSpicy
                    ? 'bg-rose-100 border-rose-400 text-rose-900'
                    : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                )}>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={formIsSpicy}
                    onChange={(e) => setFormIsSpicy(e.target.checked)}
                  />
                  <Flame className="w-3.5 h-3.5 text-rose-600" />
                  Spicy
                </label>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-stone-700">
                Menu Description (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Brief ingredients or flavour description..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
              />
            </div>

            {/* Stock Availability */}
            <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs">
              <span className="font-bold text-stone-700">Immediate Stock Availability</span>
              <button
                type="button"
                onClick={() => setFormIsAvailable(!formIsAvailable)}
                className={clsx(
                  'px-3 py-1 rounded-xl font-bold transition border cursor-pointer',
                  formIsAvailable
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-rose-50 border-rose-300 text-rose-700'
                )}
              >
                {formIsAvailable ? '✓ In Stock (Available)' : '✗ 86’d (Out of Stock)'}
              </button>
            </div>

            {/* Submit / Cancel Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSaving}
                leftIcon={<Check className="w-4 h-4" />}
              >
                {editingItem ? 'Save & Alter Item' : 'Create Menu Item'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
