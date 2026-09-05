import { useState, useEffect, useCallback } from "react";
import { 
  Plus, Trash2, Flame, Beef, Wheat, Droplet, ChevronLeft, ChevronRight, 
  Camera, X, Check, Loader2, Dumbbell, Key, Sun, Moon, Sparkles, 
  Utensils, Calendar, User, Info, CheckCircle2, ShieldCheck,
  LogIn, LogOut, UserPlus, Lock, Mail, UserCheck, ArrowRight, Zap, Star, LayoutGrid, Shield,
  Globe, Play, CheckCircle, ArrowUpRight, Scan, Barcode, Search, PackageSearch
} from "lucide-react";
import { callGemini, hasApiKey, getApiKey, setApiKey } from "./lib/gemini.js";
import { 
  auth, 
  loginWithEmail, 
  registerWithEmail, 
  loginWithGoogle, 
  loginAsGuest, 
  logoutUser,
  getUserProfile,
  saveUserProfile,
  getUserFoodLog,
  saveUserFoodLog,
  getUserWorkouts,
  saveUserWorkouts
} from "./lib/firebase.js";
import { onAuthStateChanged } from "firebase/auth";

const APP_NAME = "FitCalorie Pro";
const COMPANY_NAME = "augefw";

function computeGoals(profile) {
  if (!profile) return { calories: 2000, protein: 160, carbs: 190, fat: 65 };
  const { weight, height, age, sex, activity, goal } = profile;
  const bmr =
    sex === "f" ? 10 * weight + 6.25 * height - 5 * age - 161 : 10 * weight + 6.25 * height - 5 * age + 5;
  const factors = { sedentario: 1.2, leve: 1.375, moderado: 1.55, intenso: 1.725 };
  const tdee = bmr * (factors[activity] || 1.375);
  let goalCalories, proteinPerKg;
  if (goal === "hipertrofia") {
    goalCalories = Math.round(tdee + 250);
    proteinPerKg = 2.2;
  } else if (goal === "resistencia") {
    goalCalories = Math.round(tdee);
    proteinPerKg = 1.8;
  } else {
    goalCalories = Math.max(1200, Math.round(tdee - 500));
    proteinPerKg = 2.1;
  }
  const proteinG = Math.round(weight * proteinPerKg);
  const fatG = Math.round(weight * 0.87);
  const carbsKcal = Math.max(0, goalCalories - proteinG * 4 - fatG * 9);
  const carbsG = Math.round(carbsKcal / 4);
  return { calories: goalCalories, protein: proteinG, carbs: carbsG, fat: fatG, bmr: Math.round(bmr), tdee: Math.round(tdee) };
}

function getSwapTip(name) {
  const n = name.toLowerCase();
  if (n.includes("hambúrguer") || n.includes("hamburguer"))
    return "💡 Dica Fit: Hambúrguer de carne magra (patinho) ou peito de frango desfiado corta boa parte da gordura mantendo a proteína.";
  if (n.includes("maionese")) return "💡 Dica Fit: Iogurte natural desnatado temperado com mostarda dá cremosidade com 80% menos gordura.";
  if (n.includes("bacon"))
    return "💡 Dica Fit: Peito de peru ou lombo defumado tem menos gordura saturada mantendo o toque defumado.";
  if (n.includes("refrigerante")) return "💡 Dica Fit: Água com gás, limão e espremido ou chá gelado substitui sem calorias líquidas.";
  if (n.includes("bolo")) return "💡 Dica Fit: Versão com farinha de aveia e adoçante natural reduz drasticamente as calorias.";
  if (n.includes("frito") || n.includes("fritura"))
    return "💡 Dica Fit: Preparar na Airfryer ou grelhado com fio de azeite economiza centenas de calorias.";
  if (n.includes("batata frita")) return "💡 Dica Fit: Batata rústica assada no forno com alecrim tem muito mais fibras e menos óleo.";
  if (n.includes("sorvete")) return "💡 Dica Fit: Sorvete de banana congelada batida com cacau ou whey é cremoso e fit.";
  if (n.includes("salgadinho") || n.includes("chips")) return "💡 Dica Fit: Grão de bico crocante assado sacia com muito mais nutrientes.";
  if (n.includes("manteiga")) return "💡 Dica Fit: Requeijão light ou cottage tem mais proteína e metade da gordura.";
  return null;
}

function getExerciseTip(name) {
  const n = name.toLowerCase();
  if (n.includes("agach")) return "🔥 Foco no Quadríceps e Glúteos: O rei dos exercícios compostos para membros inferiores.";
  if (n.includes("extensor")) return "🔥 Isolador de Quadríceps: Excelente para definir a parte frontal da coxa.";
  if (n.includes("abdutor")) return "🔥 Glúteo Médio: Estabiliza o quadril e melhora a postura na corrida/agachamento.";
  if (n.includes("adutor")) return "🔥 Parte interna da coxa: Importante para o equilíbrio articular das pernas.";
  if (n.includes("leg press")) return "🔥 Força e Hipertrofia: Permite trabalhar com carga alta com total apoio lombar.";
  if (n.includes("supino")) return "🔥 Peitoral, Ombro e Tríceps: Principal padrão de empurrar para o tronco.";
  if (n.includes("remada") || n.includes("puxada") || n.includes("costas"))
    return "🔥 Dorsais e Bíceps: Fundamental para a postura e expansão das costas.";
  if (n.includes("rosca")) return "🔥 Bíceps Branquial: Foco no pico de bico e volume anterior do braço.";
  if (n.includes("tríceps") || n.includes("triceps")) return "🔥 Tríceps: Representa 60% do volume total do braço.";
  if (n.includes("panturrilha")) return "🔥 Panturrilha: O segundo coração do corpo, essencial para o retorno venoso.";
  if (n.includes("abdomen") || n.includes("abdômen") || n.includes("prancha"))
    return "🔥 Fortalecimento do Core: Melhora estabilidade lombar em todas as cargas.";
  if (n.includes("esteira") || n.includes("corrida") || n.includes("caminhada") || n.includes("bike") || n.includes("bicicleta"))
    return "🏃 Cardio Aeróbico: Aumenta a capacidade VO2 máx e expande seu limite calórico do dia.";
  return null;
}

const MACRO_META = {
  protein: { label: "Proteína", unit: "g", color: "#10b981", darkColor: "#34d399", icon: Beef },
  carbs: { label: "Carboidrato", unit: "g", color: "#eab308", darkColor: "#facc15", icon: Wheat },
  fat: { label: "Gordura", unit: "g", color: "#06b6d4", darkColor: "#22d3ee", icon: Droplet },
};

const PORTIONS = [
  { name: "Arroz branco", unit: "colher de sopa cheia", calories: 33, protein: 0.7, carbs: 7, fat: 0.1 },
  { name: "Feijão carioca", unit: "concha média", calories: 90, protein: 5, carbs: 15, fat: 0.5 },
  { name: "Macarrão cozido", unit: "colher de sopa", calories: 35, protein: 1.2, carbs: 7, fat: 0.3 },
  { name: "Batata doce / inglesa", unit: "colher de sopa", calories: 20, protein: 0.4, carbs: 4.5, fat: 0 },
  { name: "Frango grelhado", unit: "fatia média (~50g)", calories: 82, protein: 15.5, carbs: 0, fat: 1.8 },
  { name: "Patinho / Carne magra", unit: "fatia média (~100g)", calories: 220, protein: 26, carbs: 0, fat: 12 },
  { name: "Pão francês", unit: "unidade (50g)", calories: 135, protein: 4, carbs: 27, fat: 1 },
  { name: "Bolo simples", unit: "fatia média", calories: 200, protein: 3, carbs: 30, fat: 7 },
  { name: "Café preto sem açúcar", unit: "xícara (100ml)", calories: 2, protein: 0.2, carbs: 0, fat: 0 },
  { name: "Ovo cozido", unit: "unidade", calories: 70, protein: 6, carbs: 0.5, fat: 5 },
  { name: "Banana prata", unit: "unidade média", calories: 90, protein: 1, carbs: 23, fat: 0.3 },
  { name: "Whey Protein", unit: "1 scoop (30g)", calories: 120, protein: 24, carbs: 3, fat: 1.5 },
];

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("Falha ao ler imagem"));
    r.readAsDataURL(file);
  });
}

function todayKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(date) {
  const today = todayKey(new Date());
  const key = todayKey(date);
  if (key === today) return "Hoje";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === todayKey(y)) return "Ontem";
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

export default function CalorieTracker() {
  // Theme state: dark/light
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("calorie-tracker:theme") || "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("calorie-tracker:theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Firebase User Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState("login"); // 'login' | 'register'
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // View Mode: 'landing' (Página com cara de site) vs 'app' (Painel do Aplicativo)
  const [viewMode, setViewMode] = useState("landing");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setViewMode("app");
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Active Tab inside App: 'food' | 'workout' | 'recipe' | 'progress'
  const [activeTab, setActiveTab] = useState("food");

  // Toast message
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const [date, setDate] = useState(new Date());
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [photoResult, setPhotoResult] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    weight: "",
    height: "",
    age: "",
    sex: "m",
    activity: "moderado",
    goal: "emagrecimento",
  });
  const [profileError, setProfileError] = useState("");
  const [showAppInfo, setShowAppInfo] = useState(false);

  const [lgpdConsent, setLgpdConsent] = useState(() => {
    return localStorage.getItem("calorie-tracker:lgpd-consent") === "granted";
  });

  const acceptLgpdConsent = () => {
    localStorage.setItem("calorie-tracker:lgpd-consent", "granted");
    setLgpdConsent(true);
    showToast("Preferências de privacidade salvas!");
  };

  // Load Profile
  useEffect(() => {
    (async () => {
      setProfileLoading(true);
      try {
        if (currentUser) {
          const remoteProfile = await getUserProfile(currentUser.uid);
          if (remoteProfile) {
            setProfile(remoteProfile);
            setProfileLoading(false);
            return;
          }
        }
        const result = await window.storage.get("profile", false);
        if (result) setProfile(JSON.parse(result.value));
      } catch {
        // sem perfil salvo
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [currentUser]);

  function openEditProfile() {
    if (profile) {
      setProfileForm({
        weight: String(profile.weight),
        height: String(profile.height),
        age: String(profile.age),
        sex: profile.sex,
        activity: profile.activity,
        goal: profile.goal || "emagrecimento",
      });
    }
    setProfileError("");
    setEditingProfile(true);
  }

  async function saveProfile() {
    const p = {
      weight: parseFloat(profileForm.weight),
      height: parseFloat(profileForm.height),
      age: parseInt(profileForm.age, 10),
      sex: profileForm.sex,
      activity: profileForm.activity,
      goal: profileForm.goal,
    };
    if (!p.weight || !p.height || !p.age || p.weight <= 0 || p.height <= 0 || p.age <= 0) {
      setProfileError("Preencha peso, altura e idade com números válidos.");
      return;
    }
    setProfile(p);
    setEditingProfile(false);
    showToast("Perfil atualizado com sucesso!");
    try {
      if (currentUser) {
        await saveUserProfile(currentUser.uid, p);
      }
      await window.storage.set("profile", JSON.stringify(p), false);
    } catch {
      setProfileError("Perfil aplicado na sessão.");
    }
  }

  const GOALS = computeGoals(profile);

  const key = `foodlog:${todayKey(date)}`;
  const workoutKey = `workout:${todayKey(date)}`;

  const [workouts, setWorkouts] = useState([]);
  const [workoutForm, setWorkoutForm] = useState({ name: "", sets: "", reps: "", weight: "" });
  const [workoutSaving, setWorkoutSaving] = useState(false);
  const [workoutError, setWorkoutError] = useState("");

  const loadWorkouts = useCallback(async () => {
    try {
      if (currentUser) {
        const remoteWorkouts = await getUserWorkouts(currentUser.uid, todayKey(date));
        if (remoteWorkouts && remoteWorkouts.length > 0) {
          setWorkouts(remoteWorkouts);
          return;
        }
      }
      const result = await window.storage.get(workoutKey, false);
      setWorkouts(result ? JSON.parse(result.value) : []);
    } catch {
      setWorkouts([]);
    }
  }, [workoutKey, currentUser, date]);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);

  async function persistWorkouts(next) {
    setWorkouts(next);
    try {
      if (currentUser) {
        await saveUserWorkouts(currentUser.uid, todayKey(date), next);
      }
      await window.storage.set(workoutKey, JSON.stringify(next), false);
    } catch {
      setWorkoutError("Não foi possível salvar o treino.");
    }
  }

  async function addExercise() {
    setWorkoutError("");
    const sets = parseInt(workoutForm.sets, 10);
    if (!workoutForm.name.trim() || !sets || sets <= 0) {
      setWorkoutError("Preencha o nome do exercício e as séries.");
      return;
    }
    setWorkoutSaving(true);
    const name = workoutForm.name.trim();
    const exercise = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      sets,
      reps: parseInt(workoutForm.reps, 10) || 0,
      weight: parseFloat(workoutForm.weight) || 0,
      tip: getExerciseTip(name),
    };
    await persistWorkouts([...workouts, exercise]);
    setWorkoutForm({ name: "", reps: "", sets: "", weight: "" });
    setWorkoutSaving(false);
    showToast(`Exercício "${name}" adicionado!`);
  }

  async function addWorkoutPreset(items, presetName) {
    setWorkoutSaving(true);
    const newItems = items.map((item) => ({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      tip: getExerciseTip(item.name),
      ...item,
    }));
    await persistWorkouts([...workouts, ...newItems]);
    setWorkoutSaving(false);
    showToast(`Preset "${presetName}" adicionado ao treino!`);
  }

  const [cardioForm, setCardioForm] = useState({ name: "", minutes: "", calories: "" });

  async function addCardio() {
    setWorkoutError("");
    const cal = parseFloat(cardioForm.calories);
    if (!cardioForm.name.trim() || !cal || cal <= 0) {
      setWorkoutError("Preencha o nome e as calorias gastas.");
      return;
    }
    setWorkoutSaving(true);
    const name = cardioForm.name.trim();
    const cardio = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: "cardio",
      name,
      minutes: parseFloat(cardioForm.minutes) || 0,
      calories: cal,
      tip: getExerciseTip(name),
    };
    await persistWorkouts([...workouts, cardio]);
    setCardioForm({ name: "", minutes: "", calories: "" });
    setWorkoutSaving(false);
    showToast(`Cardio "${name}" registrado!`);
  }

  async function removeExercise(id) {
    await persistWorkouts(workouts.filter((w) => w.id !== id));
    showToast("Exercício removido", "info");
  }

  // Leitura de ficha de treino por foto (IA)
  const [workoutPhotoLoading, setWorkoutPhotoLoading] = useState(false);
  const [workoutPhotoResult, setWorkoutPhotoResult] = useState(null);
  const [workoutPhotoError, setWorkoutPhotoError] = useState("");

  function parseWorkoutListResponse(text) {
    if (!text) return [];
    try {
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(arrayMatch ? arrayMatch[0] : text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function analyzeWorkoutPhoto(file) {
    if (!file) return;
    setWorkoutPhotoError("");
    setWorkoutPhotoLoading(true);
    setWorkoutPhotoResult(null);
    try {
      const base64 = await fileToBase64(file);
      const mimeType = file.type || "image/jpeg";

      const text = await callGemini([
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: `Leia esta foto de uma ficha de treino de academia e liste todos os exercícios de musculação nela (ignore itens só de cardio, como esteira ou bike, que não têm séries/repetições). Use as séries e repetições impressas na ficha para cada exercício. Responda APENAS com um array JSON, sem texto ao redor, no formato: [{"name": "nome do exercício", "sets": numero, "reps": numero}]. Se não conseguir ler nenhum exercício, responda [].` },
      ]);

      const list = parseWorkoutListResponse(text);
      if (list.length === 0) {
        setWorkoutPhotoError("Não foi possível ler exercícios nessa foto. Tente uma foto mais nítida ou cadastre manualmente.");
      } else {
        setWorkoutPhotoResult(
          list.map((item) => ({
            name: item?.name ? String(item.name) : "Exercício",
            sets: item?.sets ? String(item.sets) : "",
            reps: item?.reps ? String(item.reps) : "",
            weight: "",
          }))
        );
        showToast(`${list.length} exercício(s) lido(s) da ficha!`);
      }
    } catch (err) {
      console.error(err);
      setWorkoutPhotoError("Erro ao processar a foto da ficha de treino.");
    } finally {
      setWorkoutPhotoLoading(false);
    }
  }

  function updateWorkoutPhotoItem(index, field, value) {
    setWorkoutPhotoResult((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function removeWorkoutPhotoItem(index) {
    setWorkoutPhotoResult((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : null;
    });
  }

  async function confirmWorkoutPhotoResult() {
    if (!workoutPhotoResult || workoutPhotoResult.length === 0) return;
    const items = workoutPhotoResult
      .map((item) => ({
        name: item.name.trim(),
        sets: parseInt(item.sets, 10) || 0,
        reps: parseInt(item.reps, 10) || 0,
        weight: parseFloat(item.weight) || 0,
      }))
      .filter((item) => item.name && item.sets > 0);
    if (items.length === 0) {
      setWorkoutPhotoError("Preencha ao menos o nome e as séries de um exercício.");
      return;
    }
    await addWorkoutPreset(items, "Foto do Treino");
    setWorkoutPhotoResult(null);
  }

  function discardWorkoutPhotoResult() {
    setWorkoutPhotoResult(null);
    setWorkoutPhotoError("");
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (currentUser) {
        const remoteFoodLog = await getUserFoodLog(currentUser.uid, todayKey(date));
        if (remoteFoodLog && remoteFoodLog.length > 0) {
          setEntries(remoteFoodLog);
          setLoading(false);
          return;
        }
      }
      const result = await window.storage.get(key, false);
      setEntries(result ? JSON.parse(result.value) : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [key, currentUser, date]);

  useEffect(() => {
    load();
  }, [load]);

  async function persist(next) {
    setEntries(next);
    try {
      if (currentUser) {
        await saveUserFoodLog(currentUser.uid, todayKey(date), next);
      }
      await window.storage.set(key, JSON.stringify(next), false);
    } catch {
      setError("Não foi possível salvar no armazenamento local.");
    }
  }

  async function addEntry() {
    setError("");
    const cals = parseFloat(form.calories);
    if (!form.name.trim() || isNaN(cals) || cals < 0) {
      setError("Preencha o nome e as calorias do alimento.");
      return;
    }
    setSaving(true);
    const name = form.name.trim();
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      calories: cals,
      protein: parseFloat(form.protein) || 0,
      carbs: parseFloat(form.carbs) || 0,
      fat: parseFloat(form.fat) || 0,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      swapTip: getSwapTip(name),
    };
    await persist([...entries, entry]);
    setForm({ name: "", calories: "", protein: "", carbs: "", fat: "" });
    setSaving(false);
    showToast(`"${name}" adicionado ao diário!`);
  }

  async function removeEntry(id) {
    await persist(entries.filter((en) => en.id !== id));
    showToast("Item removido do diário", "info");
  }

  function parseJsonResponse(text) {
    if (!text) return null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  async function analyzePhoto(file) {
    if (!file) return;
    setError("");
    setAnalyzing(true);
    setPhotoResult(null);
    try {
      const base64 = await fileToBase64(file);
      const mimeType = file.type || "image/jpeg";
      setPhotoPreview(`data:${mimeType};base64,${base64}`);

      const text = await callGemini([
        { inline_data: { mime_type: mimeType, data: base64 } },
        {
          text: "Identifique a comida nessa foto e estime a porção visível. Responda APENAS com um JSON válido no formato exato: {\"name\": \"nome curto do prato\", \"calories\": numero, \"protein\": numero, \"carbs\": numero, \"fat\": numero}. Os valores numéricos são em kcal e gramas. Se não conseguir identificar comida, coloque name como \"Não identificado\" e zeros nos valores.",
        },
      ]);
      if (!text) throw new Error("Sem resposta da análise");
      const parsed = parseJsonResponse(text);
      if (!parsed || !parsed.name || parsed.name.toLowerCase().includes("não identificado") || parsed.name.toLowerCase().includes("nenhuma comida")) {
        setError("Não foi possível identificar alimento na imagem. Tente aproximar da refeição e tirar outra foto.");
        setPhotoPreview(null);
      } else {
        setPhotoResult({
          name: parsed.name,
          calories: Number(parsed.calories) || 0,
          protein: Number(parsed.protein) || 0,
          carbs: Number(parsed.carbs) || 0,
          fat: Number(parsed.fat) || 0,
        });
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao chamar Gemini IA. Verifique sua conexão.");
      setPhotoPreview(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function confirmPhotoResult() {
    if (!photoResult) return;
    setSaving(true);
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: photoResult.name,
      calories: photoResult.calories,
      protein: photoResult.protein,
      carbs: photoResult.carbs,
      fat: photoResult.fat,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      swapTip: getSwapTip(photoResult.name),
    };
    await persist([...entries, entry]);
    setPhotoResult(null);
    setPhotoPreview(null);
    setSaving(false);
    showToast(`Prato "${entry.name}" registrado via Foto IA!`);
  }

  function discardPhotoResult() {
    setPhotoResult(null);
    setPhotoPreview(null);
    setError("");
  }

  // Barcode Scanner & Open Food Facts Integration
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState(null);
  const [barcodeError, setBarcodeError] = useState("");

  async function searchBarcodeProduct(codeToSearch) {
    const code = (codeToSearch || barcodeInput).trim().replace(/\D/g, "");
    if (!code) {
      setBarcodeError("Digite ou escaneie um número de código de barras válido.");
      return;
    }
    setBarcodeError("");
    setBarcodeLoading(true);
    setBarcodeResult(null);

    try {
      // 1. Busca na base de dados global do Open Food Facts
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 1 && data.product) {
          const p = data.product;
          const name = p.product_name_pt || p.product_name || "Produto Escaneado";
          const brand = p.brands ? ` (${p.brands})` : "";
          const nutriments = p.nutriments || {};

          const calories = Math.round(nutriments["energy-kcal_100g"] || nutriments["energy-kcal_serving"] || nutriments["energy-kcal"] || 0);
          const protein = Math.round(nutriments.proteins_100g || nutriments.proteins_serving || nutriments.proteins || 0);
          const carbs = Math.round(nutriments.carbohydrates_100g || nutriments.carbohydrates_serving || nutriments.carbohydrates || 0);
          const fat = Math.round(nutriments.fat_100g || nutriments.fat_serving || nutriments.fat || 0);

          setBarcodeResult({
            name: `${name}${brand}`,
            calories,
            protein,
            carbs,
            fat,
            image: p.image_front_small_url || p.image_url || null,
            barcode: code,
            source: "Open Food Facts",
          });
          showToast(`Produto "${name}" encontrado!`);
          setBarcodeLoading(false);
          return;
        }
      }

      // 2. Fallback caso não esteja cadastrado: IA Gemini
      const text = await callGemini([
        { text: `O código de barras ${code} não foi achado no Open Food Facts. Identifique o alimento industrializado correspondente a esse código de barras no Brasil. Responda APENAS com JSON: {"name": "nome do produto", "calories": numero_kcal_100g, "protein": numero_g, "carbs": numero_g, "fat": numero_g}. Se não souber, responda name como "Não encontrado".` }
      ]);
      const parsed = parseJsonResponse(text);
      if (parsed && parsed.name && !parsed.name.toLowerCase().includes("não encontrado")) {
        setBarcodeResult({
          name: parsed.name,
          calories: Number(parsed.calories) || 0,
          protein: Number(parsed.protein) || 0,
          carbs: Number(parsed.carbs) || 0,
          fat: Number(parsed.fat) || 0,
          barcode: code,
          source: "Gemini IA Database",
        });
        showToast(`Produto "${parsed.name}" identificado via IA!`);
      } else {
        setBarcodeError(`Código ${code} não encontrado na base. Tente a Foto IA ou cadastre manualmente.`);
      }
    } catch (err) {
      console.error(err);
      setBarcodeError("Erro ao consultar código de barras.");
    } finally {
      setBarcodeLoading(false);
    }
  }

  async function analyzeBarcodePhoto(file) {
    if (!file) return;
    setBarcodeError("");
    setBarcodeLoading(true);
    setBarcodeResult(null);

    try {
      const base64 = await fileToBase64(file);
      const mimeType = file.type || "image/jpeg";

      const text = await callGemini([
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: `Leia o número do código de barras (EAN-13/EAN-8) estampado nesta foto de embalagem de alimento ou identifique o produto e sua tabela nutricional (calorias, proteína, carboidrato, gordura por 100g). Responda APENAS com JSON: {"barcode": "numero_se_encontrar", "name": "nome do produto", "calories": numero, "protein": numero, "carbs": numero, "fat": numero}.` }
      ]);

      const parsed = parseJsonResponse(text);
      if (parsed && parsed.barcode) {
        setBarcodeInput(parsed.barcode);
        await searchBarcodeProduct(parsed.barcode);
      } else if (parsed && parsed.name && !parsed.name.toLowerCase().includes("não identificado")) {
        setBarcodeResult({
          name: parsed.name,
          calories: Number(parsed.calories) || 0,
          protein: Number(parsed.protein) || 0,
          carbs: Number(parsed.carbs) || 0,
          fat: Number(parsed.fat) || 0,
          source: "Leitura de Embalagem IA",
        });
        showToast(`Produto "${parsed.name}" lido da embalagem!`);
      } else {
        setBarcodeError("Não foi possível ler o código de barras na foto. Tente aproximar da barra com números legíveis.");
      }
    } catch (err) {
      console.error(err);
      setBarcodeError("Erro ao processar imagem da embalagem.");
    } finally {
      setBarcodeLoading(false);
    }
  }

  async function confirmBarcodeResult() {
    if (!barcodeResult) return;
    setSaving(true);
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: barcodeResult.name,
      calories: barcodeResult.calories,
      protein: barcodeResult.protein,
      carbs: barcodeResult.carbs,
      fat: barcodeResult.fat,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      swapTip: getSwapTip(barcodeResult.name),
    };
    await persist([...entries, entry]);
    setBarcodeResult(null);
    setBarcodeInput("");
    setSaving(false);
    showToast(`Produto "${entry.name}" registrado via Código de Barras!`);
  }

  function discardBarcodeResult() {
    setBarcodeResult(null);
    setBarcodeError("");
  }

  async function addMeal(items, label) {
    setSaving(true);
    const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const newEntries = items.map((item) => ({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      time,
      swapTip: getSwapTip(item.name),
      ...item,
    }));
    await persist([...entries, ...newEntries]);
    setSaving(false);
    showToast(`Refeição "${label}" adicionada!`);
  }

  function applyQuickFood(food) {
    setForm({
      name: `${food.name} (1 ${food.unit})`,
      calories: String(food.calories),
      protein: String(food.protein),
      carbs: String(food.carbs),
      fat: String(food.fat),
    });
    showToast(`Valores de "${food.name}" carregados no formulário.`);
  }

  function changeDay(delta) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d);
  }

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const strengthWorkouts = workouts.filter((w) => w.type !== "cardio");
  const cardioWorkouts = workouts.filter((w) => w.type === "cardio");
  const totalSets = strengthWorkouts.reduce((acc, w) => acc + w.sets, 0);
  const workoutMinutes = totalSets * 2;
  const bodyWeight = profile?.weight || 70;
  const strengthCalories = workoutMinutes > 0 ? Math.round(5 * bodyWeight * (workoutMinutes / 60)) : 0;
  const cardioCalories = cardioWorkouts.reduce((acc, w) => acc + (w.calories || 0), 0);
  const workoutCalories = strengthCalories + cardioCalories;
  const effectiveGoalCalories = GOALS.calories + workoutCalories;

  const calPct = Math.min(100, (totals.calories / effectiveGoalCalories) * 100);
  const remaining = effectiveGoalCalories - totals.calories;
  const circumference = 2 * Math.PI * 70;
  const dashoffset = circumference - (calPct / 100) * circumference;
  const overGoal = totals.calories > effectiveGoalCalories;

  const extraCarbsFromWorkout = workoutCalories > 0 ? Math.round((workoutCalories * 0.6) / 4) : 0;
  const effectiveGoalCarbs = GOALS.carbs + extraCarbsFromWorkout;

  const [weekSummary, setWeekSummary] = useState([]);
  const [weekLoading, setWeekLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setWeekLoading(true);
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d);
      }
      const results = await Promise.all(
        days.map(async (d) => {
          const dk = todayKey(d);
          let cal = 0;
          let prot = 0;
          let hasWorkout = false;
          let wCal = 0;
          try {
            if (currentUser) {
              const remoteLog = await getUserFoodLog(currentUser.uid, dk);
              if (remoteLog) {
                cal = remoteLog.reduce((a, e) => a + (e.calories || 0), 0);
                prot = remoteLog.reduce((a, e) => a + (e.protein || 0), 0);
              }
            } else {
              const f = await window.storage.get(`foodlog:${dk}`, false);
              if (f) {
                const arr = JSON.parse(f.value);
                cal = arr.reduce((a, e) => a + (e.calories || 0), 0);
                prot = arr.reduce((a, e) => a + (e.protein || 0), 0);
              }
            }
          } catch {
            // sem registro
          }
          try {
            if (currentUser) {
              const remoteWorkouts = await getUserWorkouts(currentUser.uid, dk);
              if (remoteWorkouts) {
                hasWorkout = remoteWorkouts.length > 0;
                const strength = remoteWorkouts.filter((x) => x.type !== "cardio");
                const cardio = remoteWorkouts.filter((x) => x.type === "cardio");
                const sets = strength.reduce((a, x) => a + x.sets, 0);
                const strengthCal = sets > 0 ? Math.round(5 * (profile?.weight || 70) * ((sets * 2) / 60)) : 0;
                const cardioCal = cardio.reduce((a, x) => a + (x.calories || 0), 0);
                wCal = strengthCal + cardioCal;
              }
            } else {
              const w = await window.storage.get(`workout:${dk}`, false);
              if (w) {
                const arr = JSON.parse(w.value);
                hasWorkout = arr.length > 0;
                const strength = arr.filter((x) => x.type !== "cardio");
                const cardio = arr.filter((x) => x.type === "cardio");
                const sets = strength.reduce((a, x) => a + x.sets, 0);
                const strengthCal = sets > 0 ? Math.round(5 * (profile?.weight || 70) * ((sets * 2) / 60)) : 0;
                const cardioCal = cardio.reduce((a, x) => a + (x.calories || 0), 0);
                wCal = strengthCal + cardioCal;
              }
            }
          } catch {
            // sem treino
          }
          return {
            dateKey: dk,
            label: d.toLocaleDateString("pt-BR", { weekday: "short" }),
            isToday: dk === todayKey(new Date()),
            calories: Math.round(cal),
            protein: Math.round(prot),
            hasWorkout,
            workoutCalories: wCal,
          };
        })
      );
      if (!cancelled) {
        setWeekSummary(results);
        setWeekLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries, workouts, profile, currentUser]);

  const budgetCalories = Math.max(0, remaining);
  const budgetProtein = Math.max(0, GOALS.protein - totals.protein);
  const budgetCarbs = Math.max(0, effectiveGoalCarbs - totals.carbs);
  const budgetFat = Math.max(0, GOALS.fat - totals.fat);

  const [ingredientsText, setIngredientsText] = useState("");
  const [ingredientsPhoto, setIngredientsPhoto] = useState(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeResult, setRecipeResult] = useState(null);
  const [recipeError, setRecipeError] = useState("");

  async function handleIngredientsPhoto(file) {
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      setIngredientsPhoto({ base64, type: file.type || "image/jpeg", previewUrl: `data:${file.type || "image/jpeg"};base64,${base64}` });
    } catch {
      setRecipeError("Não foi possível processar a imagem.");
    }
  }

  async function generateRecipe() {
    setRecipeError("");
    if (!ingredientsText.trim() && !ingredientsPhoto) {
      setRecipeError("Descreva ou envie foto dos ingredientes disponíveis.");
      return;
    }
    setRecipeLoading(true);
    setRecipeResult(null);
    try {
      const parts = [];
      if (ingredientsPhoto) {
        parts.push({
          inline_data: { mime_type: ingredientsPhoto.type || "image/jpeg", data: ingredientsPhoto.base64 },
        });
      }
      parts.push({
        text: `Ingredientes disponíveis: ${ingredientsText.trim() || "(ver foto)"}. Orçamento calórico restante: até ${Math.round(budgetCalories)} kcal, ${Math.round(budgetProtein)}g proteína, ${Math.round(budgetCarbs)}g carboidrato, ${Math.round(budgetFat)}g gordura. Sugira UMA receita saudável e prática para fazer agora em casa, utilizando prioritariamente os ingredientes informados (com 1-2 temperos básicos como sal/azeite). Responda EXCLUSIVAMENTE com JSON válido no formato: {"nome": "nome do prato", "modo_preparo": "passo a passo curto em texto", "calorias": numero, "proteina": numero, "carboidrato": numero, "gordura": numero}.`,
      });

      const text = await callGemini(parts);
      if (!text) throw new Error("Sem resposta do modelo");
      const parsed = parseJsonResponse(text);
      if (!parsed || !parsed.nome) {
        throw new Error("Formato de receita inválido");
      }
      setRecipeResult({
        nome: parsed.nome,
        modo_preparo: parsed.modo_preparo || "Siga o preparo padrão com os temperos a gosto.",
        calorias: Number(parsed.calorias) || 0,
        proteina: Number(parsed.proteina) || 0,
        carboidrato: Number(parsed.carboidrato) || 0,
        gordura: Number(parsed.gordura) || 0,
      });
      showToast("Receita gerada pelo Chef IA!");
    } catch (err) {
      setRecipeError("Não foi possível gerar a receita no momento. Tente novamente.");
    } finally {
      setRecipeLoading(false);
    }
  }

  async function confirmRecipe() {
    if (!recipeResult) return;
    setSaving(true);
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: recipeResult.nome,
      calories: recipeResult.calorias,
      protein: recipeResult.proteina,
      carbs: recipeResult.carboidrato,
      fat: recipeResult.gordura,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
    await persist([...entries, entry]);
    setRecipeResult(null);
    setIngredientsText("");
    setIngredientsPhoto(null);
    setSaving(false);
    showToast(`Receita "${entry.name}" adicionada às refeições!`);
  }

  function discardRecipe() {
    setRecipeResult(null);
    setRecipeError("");
  }

  // Auth form handlers
  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");
    if (!authForm.email || !authForm.password) {
      setAuthError("Preencha email e senha.");
      return;
    }
    setAuthSubmitting(true);
    try {
      if (authTab === "login") {
        await loginWithEmail(authForm.email, authForm.password);
        showToast("Login realizado com sucesso!");
      } else {
        await registerWithEmail(authForm.email, authForm.password);
        showToast("Conta criada e conectada!");
      }
      setShowAuthModal(false);
      setViewMode("app");
      setAuthForm({ email: "", password: "" });
    } catch (err) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setAuthError("Email ou senha incorretos.");
      } else if (err.code === "auth/email-already-in-use") {
        setAuthError("Este email já está cadastrado.");
      } else if (err.code === "auth/weak-password") {
        setAuthError("A senha deve ter pelo menos 6 caracteres.");
      } else {
        setAuthError("Erro na autenticação. Tente novamente.");
      }
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setAuthError("");
    try {
      await loginWithGoogle();
      showToast("Conectado com a conta Google!");
      setShowAuthModal(false);
      setViewMode("app");
    } catch (err) {
      console.error(err);
      setAuthError("Não foi possível conectar com o Google.");
    }
  }

  async function handleGuestLogin() {
    try {
      await loginAsGuest();
      showToast("Conectado como Convidado!");
      setShowAuthModal(false);
      setViewMode("app");
    } catch (err) {
      setAuthError("Erro ao entrar como convidado.");
    }
  }

  async function handleLogout() {
    try {
      await logoutUser();
      showToast("Desconectado da conta.");
      setViewMode("landing");
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl border border-emerald-400 animate-bounce">
          <CheckCircle2 size={16} />
          {toast.msg}
        </div>
      )}

      {/* TOP NAVBAR DESKTOP & MOBILE RESPONSIVE */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3.5 py-3 sm:px-6 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0" onClick={() => setViewMode("landing")}>
            <img src="/logo.png" alt="augefw Logo" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-md bg-black/20 p-1 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-extrabold text-base sm:text-xl tracking-tight bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
                  {APP_NAME}
                </span>
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  PRO
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                desenvolvido por <strong className="font-bold text-slate-700 dark:text-slate-300">{COMPANY_NAME}</strong>
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          {viewMode === "landing" && (
            <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <a href="#recursos" className="hover:text-emerald-500 transition">Recursos</a>
              <a href="#como-funciona" className="hover:text-emerald-500 transition">Como Funciona</a>
              <a href="#inteligencia-ia" className="hover:text-emerald-500 transition">IA Gemini 2.5</a>
              <a href="#login-section" className="hover:text-emerald-500 transition">Acessar Conta</a>
            </nav>
          )}

          {/* User Status / Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {viewMode === "app" ? (
              <button
                onClick={() => setViewMode("landing")}
                className="px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                ← Site
              </button>
            ) : (
              <button
                onClick={() => setViewMode("app")}
                className="px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Abrir App
              </button>
            )}

            {currentUser ? (
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 max-w-[70px] sm:max-w-[120px] truncate">
                  {currentUser.isAnonymous ? "Convidado" : currentUser.email?.split("@")[0]}
                </span>
                <button
                  onClick={handleLogout}
                  className="ml-0.5 p-0.5 text-slate-400 hover:text-rose-500 transition"
                  title="Sair da conta"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-extrabold shadow-md hover:from-emerald-500 hover:to-teal-500 transition active:scale-95"
              >
                <LogIn size={14} className="shrink-0" />
                <span>Entrar</span>
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-90"
              title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
            >
              {theme === "dark" ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-700" />}
            </button>
          </div>
        </div>
      </header>

      {/* VIEW MODE 1: PÁGINA COM CARA DE SITE (LANDING PAGE DESKTOP PREMIUM) */}
      {viewMode === "landing" ? (
        <div className="space-y-24 pb-24">
          {/* HERO SECTION DESKTOP */}
          <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white border-b border-slate-800">
            <div className="absolute top-1/4 left-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-[128px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Headlines & CTAs */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                  <Sparkles size={15} className="text-emerald-400" />
                  Inteligência Artificial Gemini 2.5 Flash
                </div>

                <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.1]">
                  A Revolução na sua <br className="hidden sm:inline" />
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                    Nutrição & Treinos
                  </span>
                </h1>

                <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl font-normal">
                  Fotografe seu prato para calcular calorias e macronutrientes instantaneamente, crie receitas sob medida com o Chef IA e mantenha seus treinos sincronizados na nuvem Firebase.
                </p>

                {/* Main Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black py-4 px-8 rounded-2xl shadow-xl shadow-emerald-500/25 transition transform hover:-translate-y-0.5 text-sm"
                  >
                    <LogIn size={18} />
                    Entrar na Minha Conta
                  </button>

                  <button
                    onClick={handleGuestLogin}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-2xl border border-slate-700 transition text-sm"
                  >
                    Testar sem Cadastro
                    <ArrowRight size={16} />
                  </button>
                </div>

                {/* Trust Badges */}
                <div className="pt-6 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-slate-400 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <span>Conformidade LGPD</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-400" />
                    <span>Banco de Dados Firebase</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-emerald-400" />
                    <span>Desenvolvido por <strong className="text-slate-200">{COMPANY_NAME}</strong></span>
                  </div>
                </div>
              </div>

              {/* Right Column: Dynamic Interactive Showcase Card */}
              <div className="lg:col-span-5 relative">
                <div className="relative mx-auto max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <img src="/app-icon.png" alt="App Icon" className="w-12 h-12 rounded-2xl shadow-md" />
                      <div>
                        <h3 className="font-display font-extrabold text-lg text-white">Demonstração ao Vivo</h3>
                        <p className="text-xs text-emerald-400 font-semibold">Gemini 2.5 Flash IA</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                      AO VIVO
                    </span>
                  </div>

                  {/* Ring Mockup */}
                  <div className="flex items-center justify-around bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      <svg width="112" height="112" viewBox="0 0 192 192" className="-rotate-90">
                        <circle cx="96" cy="96" r="70" fill="none" stroke="#1e293b" strokeWidth="16" />
                        <circle cx="96" cy="96" r="70" fill="none" stroke="#10b981" strokeWidth="16" strokeDasharray="440" strokeDashoffset="120" strokeLinecap="round" />
                      </svg>
                      <div className="absolute text-center">
                        <p className="font-display font-black text-xl text-white">1,450</p>
                        <p className="text-[10px] text-slate-400">kcal de 2,000</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between font-bold text-emerald-400 text-[11px] mb-0.5">
                          <span>Proteína</span> <span>130/160g</span>
                        </div>
                        <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 w-[80%]" />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-bold text-amber-400 text-[11px] mb-0.5">
                          <span>Carboidratos</span> <span>150/190g</span>
                        </div>
                        <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 w-[70%]" />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-bold text-cyan-400 text-[11px] mb-0.5">
                          <span>Gorduras</span> <span>45/65g</span>
                        </div>
                        <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-400 w-[60%]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setViewMode("app")}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
                  >
                    <LayoutGrid size={16} />
                    Abrir Painel do Aplicativo
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION: RECURSOS DO SITE */}
          <section id="recursos" className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
              <h2 className="font-display font-black text-3xl sm:text-4xl">
                Tecnologia Avançada para o seu Corpo
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
                Desenvolvido com o ecossistema mais moderno de IA e cloud computing para garantir máxima precisão.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200/80 dark:border-slate-800 shadow-md hover:border-emerald-500 transition duration-300 group">
                <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl w-fit mb-6 group-hover:scale-110 transition duration-300">
                  <Camera size={28} />
                </div>
                <h3 className="font-display font-bold text-xl mb-3">Reconhecimento de Pratos por Foto</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Basta apontar a câmera do seu celular para a refeição. Nossa visão computacional identifica os alimentos e estima os macronutrientes automaticamente.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200/80 dark:border-slate-800 shadow-md hover:border-emerald-500 transition duration-300 group">
                <div className="p-4 bg-amber-500/10 text-amber-500 rounded-2xl w-fit mb-6 group-hover:scale-110 transition duration-300">
                  <Sparkles size={28} />
                </div>
                <h3 className="font-display font-bold text-xl mb-3">Chef IA de Receitas</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Informe o que você tem na geladeira ou mande uma foto dos ingredientes. O Chef IA formula receitas saborosas e perfeitamente encaixadas nas suas calorias.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200/80 dark:border-slate-800 shadow-md hover:border-emerald-500 transition duration-300 group">
                <div className="p-4 bg-cyan-500/10 text-cyan-500 rounded-2xl w-fit mb-6 group-hover:scale-110 transition duration-300">
                  <Dumbbell size={28} />
                </div>
                <h3 className="font-display font-bold text-xl mb-3">Expansão de Calorias por Treino</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Registre suas séries de musculação ou sessões de cardio. O app recalcula e adiciona margem calórica diária automaticamente.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION: COMO FUNCIONA (3 PASSO A PASSO) */}
          <section id="como-funciona" className="bg-slate-200/50 dark:bg-slate-900/50 py-16 border-y border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center max-w-2xl mx-auto mb-14">
                <h2 className="font-display font-black text-3xl sm:text-4xl mb-3">Como Funciona na Prática</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">Simplicidade total em 3 passos para transformar seu dia a dia.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 relative">
                  <span className="font-display font-black text-4xl text-emerald-500/20 absolute top-4 right-6">01</span>
                  <h4 className="font-bold text-lg mb-2">Configure seu Perfil Fit</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Informe seu peso, altura e meta (emagrecimento, hipertrofia ou manutenção). O sistema calcula sua TDEE exata.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 relative">
                  <span className="font-display font-black text-4xl text-emerald-500/20 absolute top-4 right-6">02</span>
                  <h4 className="font-bold text-lg mb-2">Fotografe ou Adicione Refeições</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Utilize a câmera do seu celular para leitura por IA ou escolha entre dezenas de porções brasileiras pré-calculadas.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 relative">
                  <span className="font-display font-black text-4xl text-emerald-500/20 absolute top-4 right-6">03</span>
                  <h4 className="font-bold text-lg mb-2">Acompanhe seu Progresso</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Veja os gráficos de 7 dias, monitore seu déficit e mantenha todos os dados salvos com segurança no Firebase Cloud.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION: EMBEDDED ACCOUNT PORTAL / LOGIN */}
          <section id="login-section" className="max-w-7xl mx-auto px-6">
            <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 rounded-3xl p-8 sm:p-12 text-white border border-slate-800 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/30">
                  PORTAL DE ACESSO INDIVIDUAL
                </span>
                <h2 className="font-display font-black text-3xl sm:text-4xl leading-tight">
                  Crie sua conta ou entre agora mesmo
                </h2>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-lg">
                  Sincronização em tempo real entre seus dispositivos. Acesse por e-mail, conta do Google ou faça um teste rápido como convidado.
                </p>
                <div className="pt-2 flex items-center gap-3 text-xs text-slate-400">
                  <ShieldCheck size={18} className="text-emerald-400" />
                  <span>Segurança garantida pelo Firebase Cloud Auth</span>
                </div>
              </div>

              {/* Login Box */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800">
                {currentUser ? (
                  <div className="text-center py-6 space-y-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                      <UserCheck size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Você está conectado!</h3>
                      <p className="text-xs text-slate-500">{currentUser.email || "Convidado"}</p>
                    </div>
                    <button
                      onClick={() => setViewMode("app")}
                      className="w-full py-3 bg-emerald-600 text-white font-extrabold rounded-xl text-xs shadow-md"
                    >
                      Ir para o Painel do App
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg text-center">Acessar a Plataforma</h3>
                    
                    <button
                      onClick={handleGoogleLogin}
                      className="w-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      Entrar com Google
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { setAuthTab("login"); setShowAuthModal(true); }}
                        className="py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                      >
                        Entrar com Email
                      </button>
                      <button
                        onClick={() => { setAuthTab("register"); setShowAuthModal(true); }}
                        className="py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md"
                      >
                        Criar Conta
                      </button>
                    </div>

                    <button
                      onClick={handleGuestLogin}
                      className="w-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-semibold py-1 text-center"
                    >
                      Continuar como Convidado
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SITE FOOTER */}
          <footer className="border-t border-slate-200 dark:border-slate-800 pt-12 pb-8 bg-white dark:bg-slate-900">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-xs text-slate-500 dark:text-slate-400">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="augefw Logo" className="w-6 h-6 object-contain" />
                  <span className="font-display font-extrabold text-sm text-slate-900 dark:text-slate-100">{APP_NAME}</span>
                </div>
                <p className="leading-relaxed">
                  Sistema inteligente de nutrição, contagem de calorias e diário de treinos alimentado por Inteligência Artificial.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider text-[11px]">Plataforma</h4>
                <ul className="space-y-2">
                  <li><a href="#recursos" className="hover:underline">Recursos</a></li>
                  <li><a href="#como-funciona" className="hover:underline">Como Funciona</a></li>
                  <li><button onClick={() => setViewMode("app")} className="hover:underline">Painel App</button></li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider text-[11px]">Segurança & Privacidade</h4>
                <ul className="space-y-2">
                  <li><span>Conformidade LGPD</span></li>
                  <li><span>Criptografia Firebase</span></li>
                  <li><span>Proxy Serverless Gemini</span></li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider text-[11px]">Desenvolvimento</h4>
                <p className="leading-relaxed">
                  Desenvolvido por <strong className="text-slate-700 dark:text-slate-300 font-bold">{COMPANY_NAME}</strong>
                </p>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-3">
              <p>© {new Date().getFullYear()} {APP_NAME}. Todos os direitos reservados.</p>
              <p>desenvolvido por <strong className="text-slate-300">{COMPANY_NAME}</strong></p>
            </div>
          </footer>
        </div>
      ) : (
        /* VIEW MODE 2: PAINEL DO APLICATIVO (CONTAINER APLICATIVO) */
        <main className="max-w-xl mx-auto px-4 pt-5 pb-28">
          {/* Profile Setup / Editing Modal Screen */}
          {profileLoading ? (
            <div className="flex flex-col items-center justify-center py-28 text-slate-500">
              <Loader2 size={24} className="animate-spin text-emerald-500 mb-3" />
              <p className="text-sm font-medium">Carregando seus dados...</p>
            </div>
          ) : !profile || editingProfile ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200/80 dark:border-slate-800 transition">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                  <User size={24} />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold">
                    {profile ? "Editar Perfil Fit" : "Configure Suas Metas"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Calculamos sua TDEE e divisão de macros personalizada.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Peso (kg)</label>
                    <input
                      type="number"
                      value={profileForm.weight}
                      onChange={(e) => setProfileForm({ ...profileForm, weight: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="75"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Altura (cm)</label>
                    <input
                      type="number"
                      value={profileForm.height}
                      onChange={(e) => setProfileForm({ ...profileForm, height: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="175"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Idade</label>
                    <input
                      type="number"
                      value={profileForm.age}
                      onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="28"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Sexo Biológico</label>
                    <select
                      value={profileForm.sex}
                      onChange={(e) => setProfileForm({ ...profileForm, sex: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="m">Masculino</option>
                      <option value="f">Feminino</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Nível de Atividade</label>
                  <select
                    value={profileForm.activity}
                    onChange={(e) => setProfileForm({ ...profileForm, activity: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="sedentario">Sedentário (pouco ou nenhum exercício)</option>
                    <option value="leve">Leve (1 a 2 treinos/semana)</option>
                    <option value="moderado">Moderado (3 a 5 treinos/semana)</option>
                    <option value="intenso">Intenso (6 a 7 treinos/semana)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Objetivo Fit</label>
                  <select
                    value={profileForm.goal}
                    onChange={(e) => setProfileForm({ ...profileForm, goal: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="emagrecimento">Emagrecimento (Déficit -500 kcal)</option>
                    <option value="hipertrofia">Hipertrofia (Superávit +250 kcal)</option>
                    <option value="resistencia">Manutenção (Equilíbrio TDEE)</option>
                  </select>
                </div>

                {profileError && <p className="text-xs font-medium text-rose-500">{profileError}</p>}

                <button
                  type="button"
                  onClick={saveProfile}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition duration-200 text-sm"
                >
                  Calcular e Salvar Metas
                </button>

                {profile && (
                  <button
                    type="button"
                    onClick={() => setEditingProfile(false)}
                    className="w-full text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-1"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Date Navigator Bar */}
              <div className="flex items-center justify-between mb-5 bg-white dark:bg-slate-900 p-2.5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800">
                <button
                  onClick={() => changeDay(-1)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
                  aria-label="Dia anterior"
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="text-center">
                  <p className="font-display font-bold text-base capitalize flex items-center justify-center gap-1.5">
                    <Calendar size={15} className="text-emerald-500" />
                    {formatDateLabel(date)}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular">
                    {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>

                <button
                  onClick={() => changeDay(1)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition disabled:opacity-30"
                  aria-label="Próximo dia"
                  disabled={todayKey(date) === todayKey(new Date())}
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Main Tabs Navigation */}
              <div className="grid grid-cols-4 gap-1 p-1.5 bg-slate-200/70 dark:bg-slate-900 rounded-2xl mb-6 shadow-inner">
                <button
                  onClick={() => setActiveTab("food")}
                  className={`flex flex-col items-center py-2 px-1 rounded-xl text-xs font-bold transition duration-200 ${
                    activeTab === "food"
                      ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-md"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Utensils size={17} className="mb-0.5" />
                  Diário
                </button>
                <button
                  onClick={() => setActiveTab("workout")}
                  className={`flex flex-col items-center py-2 px-1 rounded-xl text-xs font-bold transition duration-200 ${
                    activeTab === "workout"
                      ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-md"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Dumbbell size={17} className="mb-0.5" />
                  Treinos
                </button>
                <button
                  onClick={() => setActiveTab("recipe")}
                  className={`flex flex-col items-center py-2 px-1 rounded-xl text-xs font-bold transition duration-200 ${
                    activeTab === "recipe"
                      ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-md"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Sparkles size={17} className="mb-0.5" />
                  Chef IA
                </button>
                <button
                  onClick={() => setActiveTab("progress")}
                  className={`flex flex-col items-center py-2 px-1 rounded-xl text-xs font-bold transition duration-200 ${
                    activeTab === "progress"
                      ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-md"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <User size={17} className="mb-0.5" />
                  Resumo
                </button>
              </div>

              {/* TAB 1: FOOD LOG & MAIN DASHBOARD */}
              {activeTab === "food" && (
                <div className="space-y-6">
                  {/* Ring & Macros Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-md border border-slate-200/80 dark:border-slate-800 transition">
                    <div className="flex flex-col items-center mb-6">
                      <div className="relative w-48 h-48">
                        <svg width="192" height="192" viewBox="0 0 192 192" className="-rotate-90">
                          <circle
                            cx="96"
                            cy="96"
                            r="70"
                            fill="none"
                            stroke={theme === "dark" ? "#1e293b" : "#f1f5f9"}
                            strokeWidth="14"
                          />
                          <circle
                            cx="96"
                            cy="96"
                            r="70"
                            fill="none"
                            stroke={overGoal ? "#f43f5e" : "#10b981"}
                            strokeWidth="14"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashoffset}
                            style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <Flame size={22} className={`mb-1 ${overGoal ? "text-rose-500 animate-bounce" : "text-emerald-500"}`} />
                          <p className="font-display text-3xl font-extrabold tabular tracking-tight">
                            {Math.round(totals.calories)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">de {effectiveGoalCalories} kcal</p>
                        </div>
                      </div>

                      <p className={`mt-3 text-sm font-bold ${overGoal ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {overGoal
                          ? `${Math.round(Math.abs(remaining))} kcal acima da meta`
                          : `${Math.round(remaining)} kcal restantes`}
                      </p>
                      {workoutCalories > 0 && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                          <Dumbbell size={12} /> +{workoutCalories} kcal liberadas por treinos hoje
                        </p>
                      )}
                    </div>

                    {/* Macro Progress Bars */}
                    <div className="space-y-3.5">
                      {Object.entries(MACRO_META).map(([k, meta]) => {
                        const val = totals[k];
                        const goal = k === "carbs" ? effectiveGoalCarbs : GOALS[k];
                        const pct = Math.min(100, (val / goal) * 100);
                        const Icon = meta.icon;
                        const activeColor = theme === "dark" ? meta.darkColor : meta.color;
                        return (
                          <div key={k}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="flex items-center gap-1.5 text-xs font-bold">
                                <Icon size={15} style={{ color: activeColor }} />
                                {meta.label}
                                {k === "carbs" && extraCarbsFromWorkout > 0 && (
                                  <span className="text-[10px] text-emerald-500 font-semibold">(+{extraCarbsFromWorkout}g treino)</span>
                                )}
                              </span>
                              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular">
                                {Math.round(val)} / {goal}{meta.unit}
                              </span>
                            </div>
                            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: activeColor }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Photo Meal Recognition AI */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-md border border-slate-200/80 dark:border-slate-800">
                    <h3 className="font-display font-bold text-base mb-1 flex items-center gap-2">
                      <Camera size={18} className="text-emerald-500" /> Leitura por Foto IA
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      Tire ou envie uma foto do seu prato para calcular calorias e macros instantaneamente.
                    </p>

                    <input
                      id="photo-upload-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) analyzePhoto(file);
                        e.target.value = "";
                      }}
                    />

                    {!photoResult && !analyzing && (
                      <label
                        htmlFor="photo-upload-input"
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-2xl shadow-md cursor-pointer transition active:scale-[0.98] text-sm"
                      >
                        <Camera size={18} />
                        Fotografar Prato
                      </label>
                    )}

                    {analyzing && (
                      <div className="flex items-center justify-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        <Loader2 size={18} className="animate-spin text-emerald-500" />
                        Analisando prato com Gemini IA...
                      </div>
                    )}

                    {photoResult && (
                      <div className="mt-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        {photoPreview && <img src={photoPreview} alt="Foto Prato" className="w-full h-44 object-cover" />}
                        <div className="p-4">
                          <p className="font-display font-extrabold text-lg mb-1 text-emerald-600 dark:text-emerald-400">{photoResult.name}</p>
                          <div className="grid grid-cols-4 gap-2 my-3 text-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                            <div>
                              <p className="tabular font-bold text-sm">{Math.round(photoResult.calories)}</p>
                              <p className="text-[10px] text-slate-400">kcal</p>
                            </div>
                            <div>
                              <p className="tabular font-bold text-sm text-emerald-500">{Math.round(photoResult.protein)}g</p>
                              <p className="text-[10px] text-slate-400">Prot</p>
                            </div>
                            <div>
                              <p className="tabular font-bold text-sm text-amber-500">{Math.round(photoResult.carbs)}g</p>
                              <p className="text-[10px] text-slate-400">Carb</p>
                            </div>
                            <div>
                              <p className="tabular font-bold text-sm text-cyan-500">{Math.round(photoResult.fat)}g</p>
                              <p className="text-[10px] text-slate-400">Gord</p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={discardPhotoResult}
                              className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
                            >
                              Descartar
                            </button>
                            <button
                              onClick={confirmPhotoResult}
                              disabled={saving}
                              className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 shadow-md"
                            >
                              {saving ? "Salvando..." : "Confirmar & Adicionar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Barcode Scanner Open Food Facts */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-md border border-slate-200/80 dark:border-slate-800">
                    <h3 className="font-display font-bold text-base mb-1 flex items-center gap-2">
                      <Barcode size={18} className="text-emerald-500" /> Leitor de Código de Barras
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      Escaneie ou digite o código de barras de alimentos industrializados para carregar a tabela nutricional do Open Food Facts.
                    </p>

                    <div className="flex gap-2 mb-3">
                      <div className="relative flex-1">
                        <Scan size={16} className="absolute left-3 top-3 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Digite o código (ex: 7891000100103)"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") searchBarcodeProduct(); }}
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <button
                        onClick={() => searchBarcodeProduct()}
                        disabled={barcodeLoading}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-md transition"
                      >
                        <Search size={14} />
                        Buscar
                      </button>
                    </div>

                    <input
                      id="barcode-photo-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) analyzeBarcodePhoto(file);
                        e.target.value = "";
                      }}
                    />

                    {!barcodeResult && !barcodeLoading && (
                      <label
                        htmlFor="barcode-photo-input"
                        className="w-full flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl cursor-pointer transition text-xs"
                      >
                        <Camera size={16} />
                        Fotografar Código na Embalagem
                      </label>
                    )}

                    {barcodeLoading && (
                      <div className="flex items-center justify-center gap-2 py-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <Loader2 size={16} className="animate-spin text-emerald-500" />
                        Consultando Open Food Facts & IA...
                      </div>
                    )}

                    {barcodeError && (
                      <p className="text-xs font-semibold text-rose-500 mt-2">{barcodeError}</p>
                    )}

                    {barcodeResult && (
                      <div className="mt-3 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-2">
                          {barcodeResult.image ? (
                            <img src={barcodeResult.image} alt={barcodeResult.name} className="w-12 h-12 object-contain bg-white rounded-xl p-1 border" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                              <PackageSearch size={20} />
                            </div>
                          )}
                          <div>
                            <p className="font-display font-extrabold text-sm text-emerald-600 dark:text-emerald-400">{barcodeResult.name}</p>
                            <span className="text-[10px] text-slate-400 font-medium">Fonte: {barcodeResult.source}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 my-3 text-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div>
                            <p className="tabular font-bold text-xs">{Math.round(barcodeResult.calories)}</p>
                            <p className="text-[9px] text-slate-400">kcal/100g</p>
                          </div>
                          <div>
                            <p className="tabular font-bold text-xs text-emerald-500">{Math.round(barcodeResult.protein)}g</p>
                            <p className="text-[9px] text-slate-400">Prot</p>
                          </div>
                          <div>
                            <p className="tabular font-bold text-xs text-amber-500">{Math.round(barcodeResult.carbs)}g</p>
                            <p className="text-[9px] text-slate-400">Carb</p>
                          </div>
                          <div>
                            <p className="tabular font-bold text-xs text-cyan-500">{Math.round(barcodeResult.fat)}g</p>
                            <p className="text-[9px] text-slate-400">Gord</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={discardBarcodeResult}
                            className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            Descartar
                          </button>
                          <button
                            onClick={confirmBarcodeResult}
                            disabled={saving}
                            className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 shadow-md"
                          >
                            {saving ? "Salvando..." : "Confirmar & Registrar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Meal Atalhos */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-md border border-slate-200/80 dark:border-slate-800">
                    <h3 className="font-display font-bold text-base mb-3 flex items-center gap-2">
                      <Utensils size={18} className="text-emerald-500" /> Atalhos de Refeições Rápidas
                    </h3>

                    <div className="space-y-2.5">
                      <button
                        onClick={() =>
                          addMeal([
                            { name: "Pão c/ presunto e queijo", calories: 275, protein: 15, carbs: 28, fat: 8 },
                            { name: "Fatia de bolo", calories: 220, protein: 3, carbs: 32, fat: 8 },
                            { name: "Pão de queijo", calories: 95, protein: 2, carbs: 10, fat: 5 },
                          ], "Café da manhã completo")
                        }
                        disabled={saving}
                        className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl hover:border-emerald-500 transition group text-left"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-500 transition">
                            ☕ Café da Manhã Completo (3 itens)
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">590 kcal · 22g P · 71g C · 21g G</p>
                        </div>
                        <Plus size={18} className="text-emerald-500 shrink-0" />
                      </button>

                      <button
                        onClick={() =>
                          addMeal([
                            { name: "Pão com manteiga e café", calories: 219, protein: 2, carbs: 13, fat: 17 },
                          ], "Pão c/ manteiga & café")
                        }
                        disabled={saving}
                        className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl hover:border-emerald-500 transition group text-left"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-500 transition">
                            🥖 Pão com Manteiga e Café Preto
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">219 kcal · 2g P · 13g C · 17g G</p>
                        </div>
                        <Plus size={18} className="text-emerald-500 shrink-0" />
                      </button>

                      <button
                        onClick={() =>
                          addMeal([
                            { name: "Pão de milho", calories: 150, protein: 4, carbs: 27, fat: 3 },
                            { name: "Hambúrguer de patinho", calories: 250, protein: 20, carbs: 0, fat: 18 },
                            { name: "Ovo frito", calories: 90, protein: 6, carbs: 0.5, fat: 7 },
                            { name: "Maionese & Catchup", calories: 115, protein: 0, carbs: 4, fat: 11 },
                          ], "Hambúrguer artesanal")
                        }
                        disabled={saving}
                        className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl hover:border-emerald-500 transition group text-left"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-500 transition">
                            🍔 Hambúrguer Artesanal Completo
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">605 kcal · 30g P · 32g C · 39g G</p>
                        </div>
                        <Plus size={18} className="text-emerald-500 shrink-0" />
                      </button>
                    </div>
                  </div>

                  {/* Add Custom Food Form */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-md border border-slate-200/80 dark:border-slate-800">
                    <h3 className="font-display font-bold text-base mb-3 flex items-center gap-2">
                      <Plus size={18} className="text-emerald-500" /> Adicionar Alimento Manual
                    </h3>
                    <input
                      type="text"
                      placeholder="Nome do alimento ou prato"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full mb-3 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <input
                        type="number"
                        placeholder="kcal"
                        value={form.calories}
                        onChange={(e) => setForm({ ...form, calories: e.target.value })}
                        className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm tabular focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <input
                        type="number"
                        placeholder="Prot (g)"
                        value={form.protein}
                        onChange={(e) => setForm({ ...form, protein: e.target.value })}
                        className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm tabular focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <input
                        type="number"
                        placeholder="Carb (g)"
                        value={form.carbs}
                        onChange={(e) => setForm({ ...form, carbs: e.target.value })}
                        className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm tabular focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <input
                        type="number"
                        placeholder="Gord (g)"
                        value={form.fat}
                        onChange={(e) => setForm({ ...form, fat: e.target.value })}
                        className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm tabular focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    {error && <p className="text-xs font-semibold text-rose-500 mb-2">{error}</p>}
                    <button
                      type="button"
                      onClick={addEntry}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-1.5 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-bold py-2.5 rounded-xl hover:opacity-90 active:scale-[0.99] transition text-sm shadow-sm"
                    >
                      <Plus size={16} />
                      {saving ? "Salvando..." : "Registrar Alimento"}
                    </button>
                  </div>

                  {/* Portion Calculator Helper */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-md border border-slate-200/80 dark:border-slate-800">
                    <h3 className="font-display font-bold text-base mb-1">Guia de Porções Disponíveis</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      Calculado com base no seu saldo restante ({Math.max(0, Math.round(remaining))} kcal):
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {PORTIONS.map((food) => {
                        const remCal = Math.max(0, remaining);
                        const remProt = Math.max(0, GOALS.protein - totals.protein);
                        const remCarb = Math.max(0, effectiveGoalCarbs - totals.carbs);
                        const remFat = Math.max(0, GOALS.fat - totals.fat);

                        const limits = [
                          { key: "calorias", max: food.calories > 0 ? Math.floor(remCal / food.calories) : Infinity },
                          { key: "proteína", max: food.protein > 0 ? Math.floor(remProt / food.protein) : Infinity },
                          { key: "carboidrato", max: food.carbs > 0 ? Math.floor(remCarb / food.carbs) : Infinity },
                          { key: "gordura", max: food.fat > 0 ? Math.floor(remFat / food.fat) : Infinity },
                        ];
                        const tightest = limits.reduce((a, b) => (b.max < a.max ? b : a));
                        const maxUnits = Math.max(0, tightest.max);

                        return (
                          <button
                            key={food.name}
                            onClick={() => applyQuickFood(food)}
                            className="w-full text-left p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 rounded-2xl hover:border-emerald-500 transition flex items-center justify-between"
                          >
                            <div>
                              <p className="text-xs font-bold">{food.name}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {food.calories} kcal por {food.unit}
                              </p>
                            </div>
                            <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${maxUnits > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-500"}`}>
                              {maxUnits > 0 ? `Até ${maxUnits} porções` : "0 porções"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Meals Log List */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-md border border-slate-200/80 dark:border-slate-800">
                    <h3 className="font-display font-bold text-base mb-3 flex items-center justify-between">
                      <span>Refeições Registradas</span>
                      <span className="text-xs font-normal text-slate-500">({entries.length})</span>
                    </h3>
                    {loading ? (
                      <p className="text-xs text-slate-500">Carregando refeições...</p>
                    ) : entries.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">Nenhum registro de refeição para esta data.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {entries
                          .slice()
                          .reverse()
                          .map((e) => (
                            <div
                              key={e.id}
                              className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-1 transition"
                            >
                              <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold truncate">{e.name}</p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular">
                                    {e.time} · <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.round(e.calories)} kcal</span> · P{Math.round(e.protein)}g C{Math.round(e.carbs)}g G{Math.round(e.fat)}g
                                  </p>
                                </div>
                                <button
                                  onClick={() => removeEntry(e.id)}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                                  title="Remover"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              {e.swapTip && (
                                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 mt-1">
                                  {e.swapTip}
                                </p>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: WORKOUTS */}
              {activeTab === "workout" && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-md border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                        <Dumbbell size={22} />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-base">Registro de Exercícios & Gasto</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {workoutCalories > 0
                            ? `${workoutCalories} kcal adicionadas à sua meta calórica de hoje!`
                            : "Registre seus treinos de musculação e cardio."}
                        </p>
                      </div>
                    </div>

                    {workouts.length > 0 && (
                      <div className="space-y-2.5 mb-4">
                        {workouts.map((w) => (
                          <div key={w.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-bold">{w.name}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular">
                                  {w.type === "cardio"
                                    ? `Cardio: ${w.minutes ? w.minutes + " min · " : ""}${w.calories} kcal`
                                    : `Musculação: ${w.sets} séries x ${w.reps || "?"} reps ${w.weight > 0 ? `(${w.weight}kg)` : ""}`}
                                </p>
                              </div>
                              <button
                                onClick={() => removeExercise(w.id)}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            {w.tip && (
                              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1.5">
                                {w.tip}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Preset Treino A */}
                    <button
                      onClick={() =>
                        addWorkoutPreset([
                          { name: "Agachamento com Halter", sets: 4, reps: 12, weight: 16 },
                          { name: "Cadeira Extensora", sets: 4, reps: 12, weight: 25 },
                          { name: "Cadeira Abdutora", sets: 4, reps: 15, weight: 30 },
                        ], "Treino A (Inferiores)")
                      }
                      disabled={workoutSaving}
                      className="w-full flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl hover:bg-emerald-500/20 transition mb-4 text-left"
                    >
                      <div>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          ⚡ Adicionar Preset: Treino A (Pernas Completo)
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Agachamento + Extensora + Abdutora (4x12)</p>
                      </div>
                      <Plus size={18} className="text-emerald-500 shrink-0" />
                    </button>

                    {/* Leitura de Ficha de Treino por Foto (IA) */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mb-4">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                        <Camera size={14} className="text-emerald-500" /> Ler Ficha de Treino por Foto (IA)
                      </p>

                      <input
                        id="workout-photo-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) analyzeWorkoutPhoto(file);
                          e.target.value = "";
                        }}
                      />

                      {!workoutPhotoResult && !workoutPhotoLoading && (
                        <label
                          htmlFor="workout-photo-input"
                          className="w-full flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl cursor-pointer transition text-xs"
                        >
                          <Camera size={16} />
                          Fotografar Ficha da Academia
                        </label>
                      )}

                      {workoutPhotoLoading && (
                        <div className="flex items-center justify-center gap-2 py-4 bg-white dark:bg-slate-800/60 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <Loader2 size={16} className="animate-spin text-emerald-500" />
                          Lendo exercícios da ficha...
                        </div>
                      )}

                      {workoutPhotoError && (
                        <p className="text-xs font-semibold text-rose-500 mt-2">{workoutPhotoError}</p>
                      )}

                      {workoutPhotoResult && (
                        <div className="mt-1">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                            Confira, ajuste o peso (não vem na ficha) e apague o que não quiser antes de adicionar.
                          </p>
                          <div className="space-y-2 mb-3">
                            {workoutPhotoResult.map((item, index) => (
                              <div
                                key={index}
                                className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <input
                                    type="text"
                                    placeholder="Exercício"
                                    value={item.name}
                                    onChange={(e) => updateWorkoutPhotoItem(index, "name", e.target.value)}
                                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  />
                                  <button
                                    onClick={() => removeWorkoutPhotoItem(index)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 shrink-0"
                                    title="Excluir exercício"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <input
                                    type="number"
                                    placeholder="Séries"
                                    value={item.sets}
                                    onChange={(e) => updateWorkoutPhotoItem(index, "sets", e.target.value)}
                                    className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  />
                                  <input
                                    type="number"
                                    placeholder="Reps"
                                    value={item.reps}
                                    onChange={(e) => updateWorkoutPhotoItem(index, "reps", e.target.value)}
                                    className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  />
                                  <input
                                    type="number"
                                    placeholder="Carga (kg)"
                                    value={item.weight}
                                    onChange={(e) => updateWorkoutPhotoItem(index, "weight", e.target.value)}
                                    className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={discardWorkoutPhotoResult}
                              className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
                            >
                              Descartar Tudo
                            </button>
                            <button
                              onClick={confirmWorkoutPhotoResult}
                              disabled={workoutSaving}
                              className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 shadow-md"
                            >
                              {workoutSaving ? "Salvando..." : `Adicionar ${workoutPhotoResult.length} ao Treino`}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Musculação Form */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mb-4">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Musculação (Séries & Repetições)</p>
                      <input
                        type="text"
                        placeholder="Exercício (ex: Supino Reto)"
                        value={workoutForm.name}
                        onChange={(e) => setWorkoutForm({ ...workoutForm, name: e.target.value })}
                        className="w-full mb-2.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <input
                          type="number"
                          placeholder="Séries"
                          value={workoutForm.sets}
                          onChange={(e) => setWorkoutForm({ ...workoutForm, sets: e.target.value })}
                          className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs tabular focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input
                          type="number"
                          placeholder="Reps"
                          value={workoutForm.reps}
                          onChange={(e) => setWorkoutForm({ ...workoutForm, reps: e.target.value })}
                          className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs tabular focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input
                          type="number"
                          placeholder="Carga (kg)"
                          value={workoutForm.weight}
                          onChange={(e) => setWorkoutForm({ ...workoutForm, weight: e.target.value })}
                          className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs tabular focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addExercise}
                        disabled={workoutSaving}
                        className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-500 text-xs shadow-md transition"
                      >
                        Adicionar Musculação
                      </button>
                    </div>

                    {/* Cardio Form */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Cardio (Esteira / Bike / Corrida)</p>
                      <input
                        type="text"
                        placeholder="Modalidade (ex: Esteira Inclinada)"
                        value={cardioForm.name}
                        onChange={(e) => setCardioForm({ ...cardioForm, name: e.target.value })}
                        className="w-full mb-2.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <input
                          type="number"
                          placeholder="Tempo (min)"
                          value={cardioForm.minutes}
                          onChange={(e) => setCardioForm({ ...cardioForm, minutes: e.target.value })}
                          className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs tabular focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input
                          type="number"
                          placeholder="Kcal Gastas"
                          value={cardioForm.calories}
                          onChange={(e) => setCardioForm({ ...cardioForm, calories: e.target.value })}
                          className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs tabular focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      {workoutError && <p className="text-xs font-semibold text-rose-500 mb-2">{workoutError}</p>}
                      <button
                        type="button"
                        onClick={addCardio}
                        disabled={workoutSaving}
                        className="w-full bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-bold py-2.5 rounded-xl hover:opacity-90 text-xs shadow-md transition"
                      >
                        Adicionar Cardio
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CHEF IA RECIPES */}
              {activeTab === "recipe" && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-md border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-2xl">
                        <Sparkles size={22} />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-base">Chef IA: Receita Sob Medida</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Crie receitas perfeitas para o seu saldo calórico restante ({Math.round(budgetCalories)} kcal).
                        </p>
                      </div>
                    </div>

                    {!recipeResult && !recipeLoading && (
                      <div className="space-y-3">
                        <textarea
                          placeholder="Descreva os ingredientes que possui (ex: frango, ovos, arroz, tomate...)"
                          value={ingredientsText}
                          onChange={(e) => setIngredientsText(e.target.value)}
                          rows={3}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                        />

                        <input
                          id="ingredients-photo-input"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleIngredientsPhoto(file);
                            e.target.value = "";
                          }}
                        />

                        {ingredientsPhoto ? (
                          <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                            <img src={ingredientsPhoto.previewUrl} alt="Ingredientes" className="w-full h-36 object-cover" />
                            <button
                              onClick={() => setIngredientsPhoto(null)}
                              className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-full hover:bg-slate-900"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <label
                            htmlFor="ingredients-photo-input"
                            className="w-full flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Camera size={16} />
                            Fotografar Geladeira / Ingredientes
                          </label>
                        )}

                        {recipeError && <p className="text-xs font-semibold text-rose-500">{recipeError}</p>}

                        <button
                          type="button"
                          onClick={generateRecipe}
                          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl shadow-md transition text-sm"
                        >
                          Gerar Receita Personalizada
                        </button>
                      </div>
                    )}

                    {recipeLoading && (
                      <div className="flex items-center justify-center gap-2.5 py-8 text-slate-500 font-semibold text-sm">
                        <Loader2 size={20} className="animate-spin text-amber-500" />
                        O Chef IA está formulando sua receita...
                      </div>
                    )}

                    {recipeResult && (
                      <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <h4 className="font-display font-extrabold text-base mb-2 text-emerald-600 dark:text-emerald-400">
                          {recipeResult.nome}
                        </h4>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                          {recipeResult.modo_preparo}
                        </p>

                        <div className="grid grid-cols-4 gap-2 mb-4 text-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div>
                            <p className="tabular font-bold text-sm">{Math.round(recipeResult.calorias)}</p>
                            <p className="text-[10px] text-slate-400">kcal</p>
                          </div>
                          <div>
                            <p className="tabular font-bold text-sm text-emerald-500">{Math.round(recipeResult.proteina)}g</p>
                            <p className="text-[10px] text-slate-400">Prot</p>
                          </div>
                          <div>
                            <p className="tabular font-bold text-sm text-amber-500">{Math.round(recipeResult.carboidrato)}g</p>
                            <p className="text-[10px] text-slate-400">Carb</p>
                          </div>
                          <div>
                            <p className="tabular font-bold text-sm text-cyan-500">{Math.round(recipeResult.gordura)}g</p>
                            <p className="text-[10px] text-slate-400">Gord</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={discardRecipe}
                            className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            Descartar
                          </button>
                          <button
                            onClick={confirmRecipe}
                            disabled={saving}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 shadow-md"
                          >
                            {saving ? "Salvando..." : "Registrar Receita"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: PROGRESS & RESUMO DA SEMANA */}
              {activeTab === "progress" && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-md border border-slate-200/80 dark:border-slate-800">
                    <h3 className="font-display font-bold text-base mb-1">Resumo dos Últimos 7 Dias</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Acompanhamento integrado de consumo alimentar e histórico de treino.
                    </p>

                    {weekLoading ? (
                      <p className="text-xs text-slate-500">Carregando histórico semanal...</p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {weekSummary.map((d) => {
                          const dayGoal = GOALS.calories + d.workoutCalories;
                          const pct = dayGoal > 0 ? Math.min(100, (d.calories / dayGoal) * 100) : 0;
                          return (
                            <div key={d.dateKey} className="flex items-center gap-3 py-3">
                              <span className={`text-xs font-bold w-10 capitalize ${d.isToday ? "text-emerald-500" : "text-slate-500"}`}>
                                {d.label}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular w-20 text-right">
                                {d.calories > 0 ? `${d.calories} kcal` : "—"}
                              </span>
                              <Dumbbell size={16} className={d.hasWorkout ? "text-emerald-500" : "text-slate-300 dark:text-slate-700"} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Profile Box */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-md border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-display font-bold text-base flex items-center gap-2">
                        <User size={18} className="text-emerald-500" /> Perfil de Metas
                      </h3>
                      <button
                        onClick={openEditProfile}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        Alterar Dados
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <p className="text-slate-400">Peso / Altura</p>
                        <p className="font-bold">{profile?.weight} kg · {profile?.height} cm</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Idade / Sexo</p>
                        <p className="font-bold">{profile?.age} anos · {profile?.sex === 'f' ? 'Feminino' : 'Masculino'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">TDEE Calculado</p>
                        <p className="font-bold">{GOALS.tdee} kcal/dia</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Meta Diária</p>
                        <p className="font-bold text-emerald-500">{GOALS.calories} kcal/dia</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      )}

      {/* Firebase Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                  <UserCheck size={20} />
                </div>
                <h3 className="font-display font-extrabold text-base">Entrar ou Cadastrar</h3>
              </div>
              <button onClick={() => setShowAuthModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
              <button
                onClick={() => setAuthTab("login")}
                className={`py-2 rounded-lg transition ${authTab === "login" ? "bg-white dark:bg-slate-900 shadow text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}
              >
                Entrar
              </button>
              <button
                onClick={() => setAuthTab("register")}
                className={`py-2 rounded-lg transition ${authTab === "register" ? "bg-white dark:bg-slate-900 shadow text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}
              >
                Criar Conta
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Senha</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    placeholder="******"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {authError && <p className="text-xs font-semibold text-rose-500">{authError}</p>}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-md transition text-xs flex items-center justify-center gap-2"
              >
                {authSubmitting ? <Loader2 size={16} className="animate-spin" /> : authTab === "login" ? "Entrar na Conta" : "Criar Minha Conta"}
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="flex-shrink mx-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">ou conecte com</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Google
              </button>

              <button
                type="button"
                onClick={handleGuestLogin}
                className="w-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold py-1.5 text-xs text-center"
              >
                Entrar como Convidado (sem cadastro)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LGPD Cookie Consent Banner */}
      {!lgpdConsent && (
        <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 shadow-2xl transition">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100">Privacidade & Cookies (LGPD)</p>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                  Este site utiliza cookies e armazenamento em nuvem para registrar suas refeições, treinos e metas com segurança individual, em conformidade com a LGPD (Lei Geral de Proteção de Dados).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
              <button
                onClick={acceptLgpdConsent}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition text-xs active:scale-95"
              >
                Aceitar & Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
