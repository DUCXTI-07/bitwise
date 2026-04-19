import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, Plus, Trash2, Utensils, Flame, Target, ChevronRight, User as UserIcon, Camera, AlertTriangle } from 'lucide-react';
import { db, auth, logout } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { MealLog, OperationType, UserProfile } from '../types';
import { handleFirestoreError } from '../utils/errorHandling';
import MealForm from './MealForm';
import Chatbot from './Chatbot';
import Profile from './Profile';

export default function Dashboard() {
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [view, setView] = useState<'dashboard' | 'profile'>('dashboard');
  const [dailyGoal, setDailyGoal] = useState(2500);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch Profile
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', auth.currentUser!.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          
          // Reset notification if it's a new day
          const todayStr = new Date().toISOString().split('T')[0];
          if (data.lastNotificationDate !== todayStr) {
            await setDoc(docRef, { 
              notifiedToday: false, 
              lastNotificationDate: todayStr,
              uid: auth.currentUser!.uid,
              email: auth.currentUser!.email || '',
              dailyCalorieGoal: data.dailyCalorieGoal || 2500,
              createdAt: data.createdAt || new Date().toISOString()
            }, { merge: true });
            data.notifiedToday = false;
            data.lastNotificationDate = todayStr;
          }
          
          setProfile(data);
          if (data.dailyCalorieGoal) setDailyGoal(data.dailyCalorieGoal);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser!.uid}`);
      }
    };

    fetchProfile();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'meals'),
      where('userId', '==', auth.currentUser.uid),
      where('timestamp', '>=', today.toISOString()),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mealData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MealLog));
      setMeals(mealData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'meals');
    });

    return () => unsubscribe();
  }, []);

  const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
  const totalProtein = meals.reduce((sum, meal) => sum + (meal.protein || 0), 0);
  const totalCarbs = meals.reduce((sum, meal) => sum + (meal.carbs || 0), 0);
  const totalFat = meals.reduce((sum, meal) => sum + (meal.fat || 0), 0);
  
  const proteinCals = totalProtein * 4;
  const carbsCals = totalCarbs * 4;
  const fatCals = totalFat * 9;
  const totalMacroCals = proteinCals + carbsCals + fatCals || 1;

  const progress = Math.min((totalCalories / dailyGoal) * 100, 100);

  // SMS Notification Logic
  useEffect(() => {
    const checkAndNotify = async () => {
      if (!profile || !profile.phoneNumber || profile.notifiedToday || totalCalories <= dailyGoal) return;

      const todayStr = new Date().toISOString().split('T')[0];
      const message = `⚠️ BiteWise Alert: You've exceeded your daily limit of ${dailyGoal} kcal! Current intake: ${totalCalories} kcal. Stay focused, fam!`;
      
      try {
        // Call the server-side SMS API
        const response = await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: profile.phoneNumber, message }),
        });

        if (response.ok) {
          const docRef = doc(db, 'users', auth.currentUser!.uid);
          await updateDoc(docRef, { notifiedToday: true, lastNotificationDate: todayStr });
          setProfile(prev => prev ? { ...prev, notifiedToday: true, lastNotificationDate: todayStr } : null);
        } else {
          console.error("Failed to send SMS via API");
        }
      } catch (error) {
        console.error("Failed to send SMS:", error);
      }
    };

    checkAndNotify();
  }, [totalCalories, profile, dailyGoal]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'meals', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `meals/${id}`);
    }
  };

  const mealHistoryString = meals.map(m => `${m.foodName} (${m.calories}kcal)`).join(', ');

  if (view === 'profile') {
    return <Profile onBack={() => setView('dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 pb-24">
      {/* Header */}
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/20">
            <span className="text-xl font-black text-white italic">B</span>
          </div>
          <h1 className="text-2xl font-black tracking-tighter italic">BITEWISE</h1>
        </div>
        <div className="flex items-center gap-4">
          {totalCalories > dailyGoal && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="hidden md:flex items-center gap-2 bg-red-600/20 border border-red-600/50 px-3 py-1 rounded-lg"
            >
              <Flame size={14} className="text-red-500" />
              <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter italic">Over Limit!</span>
            </motion.div>
          )}
          <button
            onClick={() => setView('profile')}
            className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
          >
            <UserIcon size={20} />
          </button>
          <button
            onClick={logout}
            className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Progress Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-8 relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Daily Burn</p>
                <div className="flex items-center gap-2">
                  <h2 className={`text-6xl font-black italic ${totalCalories > dailyGoal ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]' : ''}`}>
                    {totalCalories}
                  </h2>
                  {totalCalories > dailyGoal && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      <Flame className="text-red-500" size={32} fill="currentColor" />
                    </motion.div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Goal</p>
                <p className="text-2xl font-bold text-zinc-300">{dailyGoal} kcal</p>
              </div>
            </div>

            <div className="h-4 bg-zinc-800 rounded-full overflow-hidden mb-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)]"
              />
            </div>

            {/* Macro Percentage Breakdown */}
            <div className="mb-2 flex justify-between items-center">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Calorie Distribution</span>
              <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">Based on 4/4/9 kcal/g</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-red-500 uppercase italic">Protein</span>
                  <span className="text-[10px] font-bold text-white">{Math.round((proteinCals / totalMacroCals) * 100)}%</span>
                </div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${(proteinCals / totalMacroCals) * 100}%` }} />
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-blue-500 uppercase italic">Carbs</span>
                  <span className="text-[10px] font-bold text-white">{Math.round((carbsCals / totalMacroCals) * 100)}%</span>
                </div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${(carbsCals / totalMacroCals) * 100}%` }} />
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-amber-500 uppercase italic">Fat</span>
                  <span className="text-[10px] font-bold text-white">{Math.round((fatCals / totalMacroCals) * 100)}%</span>
                </div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${(fatCals / totalMacroCals) * 100}%` }} />
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <p className={`text-sm font-black uppercase tracking-tight ${totalCalories > dailyGoal ? 'text-red-500 animate-pulse' : 'text-zinc-500'}`}>
                  {totalCalories > dailyGoal 
                    ? "⚠️ CALORIE LIMIT EXCEEDED" 
                    : totalCalories === dailyGoal 
                      ? "Goal reached! No cap." 
                      : `${dailyGoal - totalCalories} kcal remaining`}
                </p>
                {totalCalories > dailyGoal && (
                  <p className="text-[10px] text-red-500/70 font-bold uppercase italic">You're {totalCalories - dailyGoal} kcal over the limit, fam.</p>
                )}
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-xs font-black text-red-500">{totalProtein}g</p>
                  <p className="text-[8px] font-bold text-zinc-600 uppercase">Pro</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-red-500">{totalCarbs}g</p>
                  <p className="text-[8px] font-bold text-zinc-600 uppercase">Carb</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-red-500">{totalFat}g</p>
                  <p className="text-[8px] font-bold text-zinc-600 uppercase">Fat</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Decorative background element */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-red-600/10 rounded-full blur-3xl" />
        </motion.div>

        {/* Stats Card */}
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center">
              <Flame size={24} />
            </div>
            <div>
              <p className="text-zinc-500 text-xs font-bold uppercase">Streak</p>
              <p className="text-xl font-bold">5 Days</p>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
              <Target size={24} />
            </div>
            <div>
              <p className="text-zinc-500 text-xs font-bold uppercase">Meals</p>
              <p className="text-xl font-bold">{meals.length} Logged</p>
            </div>
          </div>
        </div>

        {/* Meal List */}
        <div className="md:col-span-3">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black italic uppercase">Today's Fuel</h3>
            <button
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-700 transition-all active:scale-95"
            >
              <Plus size={18} />
              ADD MEAL
            </button>
          </div>

          <div className="space-y-3">
            {meals.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-3xl p-12 text-center">
                <Utensils size={40} className="mx-auto mb-4 text-zinc-700" />
                <p className="text-zinc-500 font-medium">No meals logged yet. Don't starve, fam.</p>
              </div>
            ) : (
              meals.map((meal) => (
                <motion.div
                  layout
                  key={meal.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between group hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-4">
                    {meal.imageUrl ? (
                      <img src={meal.imageUrl} alt={meal.foodName} className="w-12 h-12 rounded-xl object-cover border border-zinc-800" />
                    ) : (
                      <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400">
                        <Utensils size={18} />
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-zinc-100">{meal.foodName}</h4>
                      <div className="flex gap-2">
                        <p className="text-xs text-zinc-500 uppercase font-bold">{meal.mealType}</p>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase">P: {meal.protein || 0}g • C: {meal.carbs || 0}g • F: {meal.fat || 0}g</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <p className="font-black text-red-500">{meal.calories} kcal</p>
                    <button
                      onClick={() => meal.id && handleDelete(meal.id)}
                      className="p-2 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      <MealForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
      <Chatbot mealHistory={mealHistoryString} />
    </div>
  );
}
