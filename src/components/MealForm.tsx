import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Utensils, Zap, Camera, Image as ImageIcon, Sparkles } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { OperationType } from '../types';
import { handleFirestoreError } from '../utils/errorHandling';
import { analyzeFoodImage, analyzeFoodText } from '../services/gemini';

interface MealFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MealForm({ isOpen, onClose }: MealFormProps) {
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTextAnalyzing, setIsTextAnalyzing] = useState(false);
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null);
  const [userQuantity, setUserQuantity] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextAnalyze = async () => {
    if (!foodName || isTextAnalyzing) return;
    setIsTextAnalyzing(true);
    try {
      const data = await analyzeFoodText(foodName);
      setCalories(data.calories.toString());
      setProtein(data.protein.toString());
      setCarbs(data.carbs.toString());
      setFat(data.fat.toString());
    } catch (error) {
      console.error("Text analysis failed:", error);
    } finally {
      setIsTextAnalyzing(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setImageUrl(base64);
        
        // Clear existing data to show refresh
        setFoodName('');
        setCalories('');
        setProtein('');
        setCarbs('');
        setFat('');
        
        // Auto-analyze image
        setIsAnalyzing(true);
        setClarificationQuestion(null);
        try {
          const data = await analyzeFoodImage(base64);
          
          if (data.needsClarification) {
            setClarificationQuestion(data.clarificationQuestion);
            setFoodName(data.foodName);
          } else {
            setFoodName(data.foodName);
            setCalories(data.calories.toString());
            setProtein(data.protein.toString());
            setCarbs(data.carbs.toString());
            setFat(data.fat.toString());
          }
        } catch (error) {
          console.error("AI Analysis failed:", error);
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClarificationSubmit = async () => {
    if (!userQuantity || !imageUrl || isAnalyzing) return;
    
    setIsAnalyzing(true);
    try {
      const data = await analyzeFoodImage(imageUrl, userQuantity);
      setCalories(data.calories.toString());
      setProtein(data.protein.toString());
      setCarbs(data.carbs.toString());
      setFat(data.fat.toString());
      setClarificationQuestion(null);
      setUserQuantity('');
    } catch (error) {
      console.error("Clarification analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName || !calories || !auth.currentUser || isLoading) return;

    setIsLoading(true);
    try {
      await addDoc(collection(db, 'meals'), {
        userId: auth.currentUser.uid,
        foodName,
        calories: parseInt(calories),
        protein: protein ? parseInt(protein) : 0,
        carbs: carbs ? parseInt(carbs) : 0,
        fat: fat ? parseInt(fat) : 0,
        imageUrl: imageUrl || '',
        mealType,
        timestamp: new Date().toISOString()
      });
      setFoodName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setImageUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'meals');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl my-8"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-white italic">LOG MEAL</h2>
              <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image Upload Area */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-48 bg-zinc-800 border-2 border-dashed border-zinc-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-red-500 transition-all overflow-hidden relative group"
              >
                {imageUrl ? (
                  <>
                    <img src={imageUrl} alt="Food" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="text-white" size={32} />
                    </div>
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                        <Sparkles className="text-red-500 animate-pulse mb-2" size={32} />
                        <p className="text-white text-xs font-black italic uppercase tracking-widest">AI Analyzing...</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Camera className="text-zinc-500 mb-2" size={32} />
                    <p className="text-zinc-500 text-sm font-bold">SNAP FOOD PIC</p>
                    <p className="text-zinc-600 text-[10px] uppercase font-bold mt-1">AI will identify macros</p>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageChange} 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                />
              </div>

              {/* Clarification Question */}
              <AnimatePresence>
                {clarificationQuestion && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-600/10 border border-red-600/30 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex items-start gap-2">
                      <Sparkles className="text-red-500 shrink-0 mt-1" size={16} />
                      <p className="text-xs font-bold text-white italic">{clarificationQuestion}</p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={userQuantity}
                        onChange={(e) => setUserQuantity(e.target.value)}
                        placeholder="e.g. 200g, 1 cup, 2 pieces"
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                      />
                      <button
                        type="button"
                        onClick={handleClarificationSubmit}
                        disabled={!userQuantity || isAnalyzing}
                        className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase italic disabled:opacity-50"
                      >
                        Update
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Food Name</label>
                <div className="relative flex gap-2">
                  <input
                    type="text"
                    required
                    value={foodName}
                    onChange={(e) => setFoodName(e.target.value)}
                    placeholder="e.g. Chicken Salad"
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleTextAnalyze}
                    disabled={!foodName || isTextAnalyzing}
                    className="px-4 bg-zinc-800 border border-zinc-700 rounded-xl text-red-500 hover:bg-zinc-700 transition-all disabled:opacity-50 flex items-center justify-center"
                    title="AI Magic - Estimate Macros from Name"
                  >
                    {isTextAnalyzing ? <Sparkles className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Calories</label>
                  <input
                    type="number"
                    required
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    placeholder="0"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Type</label>
                  <select
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value as any)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all appearance-none"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Protein (g)</label>
                  <input
                    type="number"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    placeholder="0"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Carbs (g)</label>
                  <input
                    type="number"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    placeholder="0"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Fat (g)</label>
                  <input
                    type="number"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    placeholder="0"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-all"
                  />
                </div>
              </div>

              {/* Macro Percentage Preview */}
              {(protein || carbs || fat) && (
                <div className="bg-zinc-800/50 rounded-xl p-3 flex justify-between items-center">
                  <div className="flex gap-4 text-[10px] font-black uppercase tracking-tighter">
                    <div className="flex flex-col">
                      <span className="text-red-500">Protein</span>
                      <span className="text-white">{Math.round((parseInt(protein || '0') * 4 / (parseInt(calories) || 1)) * 100)}%</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-blue-500">Carbs</span>
                      <span className="text-white">{Math.round((parseInt(carbs || '0') * 4 / (parseInt(calories) || 1)) * 100)}%</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-amber-500">Fat</span>
                      <span className="text-white">{Math.round((parseInt(fat || '0') * 9 / (parseInt(calories) || 1)) * 100)}%</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase italic">Calorie Ratio</div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || isAnalyzing}
                className="w-full bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Zap className="animate-spin" size={20} /> : <Plus size={20} />}
                {isAnalyzing ? "AI ANALYZING..." : "ADD MEAL"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
