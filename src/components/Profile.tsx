import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Calendar, BarChart3, PieChart as PieChartIcon, User as UserIcon, Save, Phone, Ruler, Scale, Activity, Edit2 } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, limit, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { MealLog, OperationType, UserProfile } from '../types';
import { handleFirestoreError } from '../utils/errorHandling';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function Profile({ onBack }: { onBack: () => void }) {
  const [history, setHistory] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Form state
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => setSaveStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch Profile
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', auth.currentUser!.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          setProfile(data);
          setHeight(data.height?.toString() || '');
          setWeight(data.weight?.toString() || '');
          setAge(data.age?.toString() || '');
          setPhoneNumber(data.phoneNumber || '');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser!.uid}`);
      }
    };

    fetchProfile();

    let q;
    if (selectedDate) {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      q = query(
        collection(db, 'meals'),
        where('userId', '==', auth.currentUser.uid),
        where('timestamp', '>=', startOfDay.toISOString()),
        where('timestamp', '<=', endOfDay.toISOString()),
        orderBy('timestamp', 'desc')
      );
    } else {
      q = query(
        collection(db, 'meals'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MealLog));
      setHistory(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'meals');
    });

    return () => unsubscribe();
  }, [selectedDate]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || isSaving) return;

    setIsSaving(true);
    setSaveStatus(null);
    
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid);
      
      const parsedHeight = parseFloat(height);
      const parsedWeight = parseFloat(weight);
      const parsedAge = parseInt(age);

      const updatedData: Partial<UserProfile> = {
        height: isNaN(parsedHeight) ? null : parsedHeight,
        weight: isNaN(parsedWeight) ? null : parsedWeight,
        age: isNaN(parsedAge) ? null : parsedAge,
        phoneNumber: phoneNumber.trim(),
      };

      // Ensure required fields are present to satisfy security rules
      if (!profile || !profile.uid || !profile.email || !profile.dailyCalorieGoal) {
        Object.assign(updatedData, {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email || '',
          displayName: auth.currentUser.displayName || profile?.displayName || '',
          dailyCalorieGoal: profile?.dailyCalorieGoal || 2500,
          createdAt: profile?.createdAt || new Date().toISOString()
        });
      }

      await setDoc(docRef, updatedData, { merge: true });
      
      setProfile(prev => prev ? { ...prev, ...updatedData } : updatedData as UserProfile);
      setSaveStatus({ type: 'success', message: 'Profile updated successfully!' });
      
      // Close editing block after a short delay to show success message
      setTimeout(() => {
        setIsEditing(false);
      }, 1500);
    } catch (error) {
      setSaveStatus({ type: 'error', message: 'Failed to update profile. Please try again.' });
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const totalStats = history.reduce((acc, meal) => ({
    calories: acc.calories + meal.calories,
    protein: acc.protein + (meal.protein || 0),
    carbs: acc.carbs + (meal.carbs || 0),
    fat: acc.fat + (meal.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const chartData = [
    { name: 'Protein', value: totalStats.protein, color: '#ef4444' }, // red-500
    { name: 'Carbs', value: totalStats.carbs, color: '#3b82f6' },   // blue-500
    { name: 'Fat', value: totalStats.fat, color: '#f59e0b' },     // amber-500
  ].filter(item => item.value > 0);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-black text-zinc-100 p-4 md:p-8"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
            Back to Dashboard
          </button>

          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2">
            <Calendar size={18} className="text-red-500" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-white focus:outline-none [color-scheme:dark]"
            />
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate('')}
                className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-tighter"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 mb-12">
          <div className="w-24 h-24 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-center text-red-600">
            <UserIcon size={48} />
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-black tracking-tighter uppercase italic">{profile?.displayName || auth.currentUser?.displayName || 'User'}</h1>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-red-500 transition-all"
              >
                <Edit2 size={16} />
              </button>
            </div>
            <p className="text-zinc-500 font-medium">{auth.currentUser?.email}</p>
          </div>
        </div>

        {/* Personal Details Form */}
        <AnimatePresence>
          {isEditing && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 mb-12 overflow-hidden"
            >
              <h3 className="text-xl font-black italic uppercase mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={20} className="text-red-500" />
                  Personal Details
                </div>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="text-xs font-black text-zinc-500 hover:text-white uppercase tracking-tighter"
                >
                  Cancel
                </button>
              </h3>
              <form onSubmit={handleSaveProfile} className="space-y-6">
                {saveStatus && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl text-sm font-bold text-center ${
                      saveStatus.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}
                  >
                    {saveStatus.message}
                  </motion.div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 flex items-center gap-2">
                      <Ruler size={14} /> Height (cm)
                    </label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="175"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 flex items-center gap-2">
                      <Scale size={14} /> Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="70"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Age</label>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="21"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 flex items-center gap-2">
                      <Phone size={14} /> Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1234567890"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Save className="animate-spin" size={20} /> : <Save size={20} />}
                  SAVE PROFILE DETAILS
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
              <BarChart3 size={16} className="text-red-500" />
              {selectedDate ? 'Daily Stats' : 'All-Time Stats'}
            </h3>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-4xl font-black italic">{totalStats.calories}</p>
                <p className="text-zinc-500 text-xs font-bold uppercase">Total Kcal</p>
              </div>
              <div>
                <p className="text-4xl font-black italic text-red-500">{history.length}</p>
                <p className="text-zinc-500 text-xs font-bold uppercase">Meals Logged</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
              <PieChartIcon size={16} className="text-red-500" />
              Macro Breakdown (g)
            </h3>
            
            {chartData.length > 0 ? (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-zinc-600 italic">
                No macro data logged yet.
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <p className="text-2xl font-black italic text-red-500">{totalStats.protein}</p>
                <p className="text-zinc-500 text-[10px] font-bold uppercase">Protein</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black italic text-blue-500">{totalStats.carbs}</p>
                <p className="text-zinc-500 text-[10px] font-bold uppercase">Carbs</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black italic text-amber-500">{totalStats.fat}</p>
                <p className="text-zinc-500 text-[10px] font-bold uppercase">Fat</p>
              </div>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-black italic uppercase mb-6 flex items-center gap-2">
          <Calendar size={20} className="text-red-500" />
          {selectedDate ? `Intake for ${new Date(selectedDate).toLocaleDateString()}` : 'Recent Intake History'}
        </h3>

        <div className="space-y-4">
          {history.length === 0 ? (
            <p className="text-zinc-500 text-center py-12 bg-zinc-900/50 rounded-3xl border border-dashed border-zinc-800">
              {selectedDate ? 'No meals logged for this day.' : 'No history found. Start logging!'}
            </p>
          ) : (
            history.map((meal) => (
              <div key={meal.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
                {meal.imageUrl ? (
                  <img src={meal.imageUrl} alt={meal.foodName} className="w-16 h-16 rounded-xl object-cover border border-zinc-800" />
                ) : (
                  <div className="w-16 h-16 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-600">
                    <Calendar size={24} />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-zinc-100">{meal.foodName}</h4>
                      <p className="text-xs text-zinc-500 uppercase font-bold">{new Date(meal.timestamp).toLocaleDateString()} • {meal.mealType}</p>
                    </div>
                    <p className="font-black text-red-500">{meal.calories} kcal</p>
                  </div>
                  <div className="flex gap-4 mt-2">
                    <span className="text-[10px] font-bold text-zinc-600 uppercase">P: {meal.protein || 0}g</span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase">C: {meal.carbs || 0}g</span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase">F: {meal.fat || 0}g</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
