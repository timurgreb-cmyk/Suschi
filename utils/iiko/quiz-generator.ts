import fs from "fs";
import path from "path";
import { getIikoSushiRecipes, IikoRecipe, IikoRecipeIngredient } from "./calculations";

export interface QuizQuestion {
  id: string;
  type: "protein_weight" | "base_weight" | "cheese_sauce_weight" | "dish_yield" | "ratio";
  dishName: string;
  dishCategory: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const CACHE_FILE_PATH = path.join(process.cwd(), "data", "iiko_recipes_sushi_control.json");

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function isKeyCulinaryIngredient(ing: IikoRecipeIngredient): boolean {
  const name = (ing.name || "").toLowerCase().trim();
  const unit = (ing.unit || "").toLowerCase();
  const gross = ing.grossAmount || 0;

  const bannedKeywords = [
    "соль", "перец", "специ", "приправ", "сахар", "лавровый",
    "сода", "разрыхлитель", "крахмал", "уксус", "краситель",
    "вода питьев", "лед", "бумага", "пергамент", "палочки", "бокс", "контейнер"
  ];

  if (bannedKeywords.some((b) => name.includes(b))) {
    return false;
  }

  const grossGrams = (unit.includes("кг") || unit.includes("л")) ? gross * 1000 : gross;

  const isHighValue = name.includes("лосос") || name.includes("угор") || name.includes("тунец") || name.includes("кревет") || name.includes("тобико") || name.includes("нори") || name.includes("сыр");

  if (!isHighValue && grossGrams < 10) {
    return false;
  }

  return true;
}

export function cleanIngredientName(rawName: string): string {
  let cleaned = rawName
    .replace(/^пф[\s._\-]+/i, "")
    .replace(/\s+(тв|товар|весовой)$/i, "")
    .replace(/\s+тв\s+/i, " ")
    .replace(/пф\s+/i, "")
    .trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

function getIngredientGrams(ing: IikoRecipeIngredient): number {
  const unit = (ing.unit || "").toLowerCase();
  const gross = ing.grossAmount || 0;
  if (unit.includes("кг") || unit.includes("л")) {
    return Math.round(gross * 1000);
  }
  return Math.round(gross);
}

function formatCleanGrams(grams: number): string {
  const rounded = Math.round(grams);
  if (rounded >= 1000) {
    return `${(rounded / 1000).toFixed(1)} кг`;
  }
  return `${rounded} г`;
}

function generateWeightDistractors(targetGrams: number): string[] {
  const step = targetGrams <= 50 ? 10 : targetGrams <= 120 ? 20 : targetGrams <= 250 ? 30 : 50;
  const candidateDeltas = [-step, step, -step * 2, step * 2, -Math.round(step * 1.5), Math.round(step * 1.5)];
  
  const optionsSet = new Set<string>();
  const correctStr = formatCleanGrams(targetGrams);

  for (const delta of shuffle(candidateDeltas)) {
    const val = Math.max(5, Math.round((targetGrams + delta) / 5) * 5);
    const str = formatCleanGrams(val);
    if (str !== correctStr && !optionsSet.has(str)) {
      optionsSet.add(str);
      if (optionsSet.size >= 3) break;
    }
  }

  const fallbacks = [10, 20, 30, 40, 50, 70, 80, 100, 120, 140, 160, 180, 200, 220, 250].map(formatCleanGrams);
  for (const fb of shuffle(fallbacks)) {
    if (optionsSet.size >= 3) break;
    if (fb !== correctStr && !optionsSet.has(fb)) {
      optionsSet.add(fb);
    }
  }

  return Array.from(optionsSet).slice(0, 3);
}

export async function generate30QuestionsFromRecipes(): Promise<QuizQuestion[]> {
  let recipes: IikoRecipe[] = [];

  if (fs.existsSync(CACHE_FILE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, "utf-8"));
      recipes = data.recipes || [];
    } catch {
      // fallback
    }
  }

  if (recipes.length === 0) {
    const data = await getIikoSushiRecipes(false);
    recipes = data.recipes || [];
  }

  const validRecipes = recipes.filter((r) => {
    const cat = (r.category || "").toLowerCase();
    const name = (r.name || "").toLowerCase();
    if (name.includes("доставка")) return false;
    if (cat.includes("допы") || cat.includes("соусы")) return false;
    return (r.ingredients || []).filter(isKeyCulinaryIngredient).length >= 1;
  });

  const questions: QuizQuestion[] = [];
  const shuffledRecipes = shuffle(validRecipes);
  let qIndex = 0;

  // 1. Вопросы на норму закладки рыбы / морепродуктов / основного белка
  for (let i = 0; i < shuffledRecipes.length && questions.length < 15; i++) {
    const recipe = shuffledRecipes[i];
    const keyIngs = (recipe.ingredients || []).filter(isKeyCulinaryIngredient);
    if (keyIngs.length === 0) continue;

    const proteinKeywords = ["лосос", "семг", "угор", "тунец", "кревет", "краб", "куриц", "говядин", "бекон"];
    let targetIng = keyIngs.find((ing) => proteinKeywords.some((p) => ing.name.toLowerCase().includes(p)));
    if (!targetIng) {
      targetIng = keyIngs.sort((a, b) => b.grossAmount - a.grossAmount)[0];
    }
    if (!targetIng) continue;

    const grams = getIngredientGrams(targetIng);
    if (grams <= 0) continue;

    const correctVal = formatCleanGrams(grams);
    const distractors = generateWeightDistractors(grams);
    const options = shuffle([correctVal, ...distractors]);
    const correctIndex = options.indexOf(correctVal);

    let stationHint = "Суши-цех";
    const catLower = (recipe.category || "").toLowerCase();
    if (catLower.includes("пицц")) stationHint = "Пицца-станция";
    else if (catLower.includes("вок") || catLower.includes("лапша")) stationHint = "WOK-станция";
    else if (catLower.includes("суп") || catLower.includes("горяч")) stationHint = "Горячий цех";

    const cleanName = cleanIngredientName(targetIng.name);

    questions.push({
      id: `q_protein_${qIndex++}`,
      type: "protein_weight",
      dishName: recipe.name,
      dishCategory: recipe.category,
      question: `${stationHint}: сколько грамм ингредиента «${cleanName}» закладывается по раскладке в «${recipe.name}»?`,
      options,
      correctIndex,
      explanation: `По стандартам ТТК iiko: норма закладки «${cleanName}» в «${recipe.name}» составляет ${correctVal}.`,
    });
  }

  // 2. Вопросы на норму закладки риса, сыра, нори или соусов
  const recipesForBases = shuffle(validRecipes);
  for (let i = 0; i < recipesForBases.length && questions.length < 25; i++) {
    const recipe = recipesForBases[i];
    const keyIngs = (recipe.ingredients || []).filter(isKeyCulinaryIngredient);
    
    const baseKeywords = ["рис", "сыр", "сливочн", "творож", "нори", "авокадо", "огурец", "соус", "спайси", "унаги", "тобико", "масаго"];
    const candidateIngs = keyIngs.filter((ing) => baseKeywords.some((b) => ing.name.toLowerCase().includes(b)));
    if (candidateIngs.length === 0) continue;

    const targetIng = candidateIngs[Math.floor(Math.random() * candidateIngs.length)];
    const grams = getIngredientGrams(targetIng);
    if (grams <= 0) continue;

    const correctVal = formatCleanGrams(grams);
    const distractors = generateWeightDistractors(grams);
    const options = shuffle([correctVal, ...distractors]);
    const correctIndex = options.indexOf(correctVal);

    const cleanName = cleanIngredientName(targetIng.name);

    questions.push({
      id: `q_base_${qIndex++}`,
      type: "base_weight",
      dishName: recipe.name,
      dishCategory: recipe.category,
      question: `Раскладка: сколько грамм «${cleanName}» требуется для приготовления порции «${recipe.name}»?`,
      options,
      correctIndex,
      explanation: `По стандартам ТТК iiko: закладка «${cleanName}» в «${recipe.name}» равна ${correctVal}.`,
    });
  }

  // 3. Вопросы на общий выход порции
  const recipesForYield = shuffle(validRecipes);
  for (let i = 0; i < recipesForYield.length && questions.length < 30; i++) {
    const recipe = recipesForYield[i];
    const sumGrams = (recipe.ingredients || []).reduce((acc, ing) => acc + getIngredientGrams(ing), 0);
    if (sumGrams < 50) continue;

    const correctVal = formatCleanGrams(Math.round(sumGrams / 5) * 5);
    const distractors = generateWeightDistractors(sumGrams);
    const options = shuffle([correctVal, ...distractors]);
    const correctIndex = options.indexOf(correctVal);

    questions.push({
      id: `q_yield_${qIndex++}`,
      type: "dish_yield",
      dishName: recipe.name,
      dishCategory: recipe.category,
      question: `Какой суммарный вес (нетто) порции блюда «${recipe.name}» по технологической карте?`,
      options,
      correctIndex,
      explanation: `По техкарте суммарный вес компонентов блюда «${recipe.name}» составляет около ${correctVal}.`,
    });
  }

  return questions;
}
