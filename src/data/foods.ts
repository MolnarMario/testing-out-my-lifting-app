import type { Food } from "../lib/food";

/**
 * Per 100 g (solids) or 100 ml (liquids). Carried over from the original build's
 * table so logged numbers stay comparable.
 */
export const DEFAULT_FOODS: Food[] = [

  // Vegetables & Roots
  { id: "df-potatoes", name: "Potatoes", cat: "Vegetables & Roots", type: "solid", kcal: 77, fat: 0.1, carbs: 17, fiber: 2.2, protein: 2 },
  { id: "df-onions", name: "Onions", cat: "Vegetables & Roots", type: "solid", kcal: 40, fat: 0.1, carbs: 9.3, fiber: 1.7, protein: 1.1 },
  { id: "df-garlic", name: "Garlic", cat: "Vegetables & Roots", type: "solid", kcal: 149, fat: 0.5, carbs: 33, fiber: 2.1, protein: 6.4 },
  { id: "df-tomatoes", name: "Tomatoes", cat: "Vegetables & Roots", type: "solid", kcal: 18, fat: 0.2, carbs: 3.9, fiber: 1.2, protein: 0.9 },
  { id: "df-bell-peppers", name: "Bell peppers", cat: "Vegetables & Roots", type: "solid", kcal: 26, fat: 0.3, carbs: 6, fiber: 2.1, protein: 1 },
  { id: "df-red-pointed-peppers", name: "Red pointed peppers", cat: "Vegetables & Roots", type: "solid", kcal: 30, fat: 0.3, carbs: 7, fiber: 2, protein: 1 },
  { id: "df-cucumbers", name: "Cucumbers", cat: "Vegetables & Roots", type: "solid", kcal: 15, fat: 0.1, carbs: 3.6, fiber: 0.5, protein: 0.7 },
  { id: "df-carrots", name: "Carrots", cat: "Vegetables & Roots", type: "solid", kcal: 41, fat: 0.2, carbs: 9.6, fiber: 2.8, protein: 0.9 },
  { id: "df-white-cabbage", name: "White cabbage", cat: "Vegetables & Roots", type: "solid", kcal: 25, fat: 0.1, carbs: 5.8, fiber: 2.5, protein: 1.3 },
  { id: "df-sauerkraut", name: "Sauerkraut", cat: "Vegetables & Roots", type: "solid", kcal: 19, fat: 0.1, carbs: 4.3, fiber: 2.9, protein: 0.9 },
  { id: "df-eggplant", name: "Eggplant", cat: "Vegetables & Roots", type: "solid", kcal: 25, fat: 0.2, carbs: 5.9, fiber: 3, protein: 1 },
  { id: "df-zucchini", name: "Zucchini", cat: "Vegetables & Roots", type: "solid", kcal: 17, fat: 0.3, carbs: 3.1, fiber: 1, protein: 1.2 },
  { id: "df-mushrooms", name: "Mushrooms", cat: "Vegetables & Roots", type: "solid", kcal: 22, fat: 0.3, carbs: 3.3, fiber: 1, protein: 3.1 },
  { id: "df-spinach", name: "Spinach", cat: "Vegetables & Roots", type: "solid", kcal: 23, fat: 0.4, carbs: 3.6, fiber: 2.2, protein: 2.9 },
  { id: "df-lettuce", name: "Lettuce", cat: "Vegetables & Roots", type: "solid", kcal: 15, fat: 0.2, carbs: 2.9, fiber: 1.3, protein: 1.4 },
  { id: "df-broccoli", name: "Broccoli", cat: "Vegetables & Roots", type: "solid", kcal: 34, fat: 0.4, carbs: 6.6, fiber: 2.6, protein: 2.8 },
  { id: "df-cauliflower", name: "Cauliflower", cat: "Vegetables & Roots", type: "solid", kcal: 25, fat: 0.3, carbs: 5, fiber: 2, protein: 1.9 },
  { id: "df-green-beans", name: "Green beans", cat: "Vegetables & Roots", type: "solid", kcal: 31, fat: 0.2, carbs: 7, fiber: 2.7, protein: 1.8 },
  { id: "df-green-peas", name: "Green peas", cat: "Vegetables & Roots", type: "solid", kcal: 81, fat: 0.4, carbs: 14.5, fiber: 5.7, protein: 5.4 },
  { id: "df-celeriac", name: "Celeriac", cat: "Vegetables & Roots", type: "solid", kcal: 42, fat: 0.3, carbs: 9.2, fiber: 1.8, protein: 1.5 },

  // Meat & Fish
  { id: "df-chicken-breast-skinless", name: "Chicken breast (skinless)", cat: "Meat & Fish", type: "solid", kcal: 120, fat: 2.6, carbs: 0, fiber: 0, protein: 22.5 },
  { id: "df-chicken-thighs-skinless", name: "Chicken thighs (skinless)", cat: "Meat & Fish", type: "solid", kcal: 121, fat: 4.1, carbs: 0, fiber: 0, protein: 19.7 },
  { id: "df-minced-beef-pork-mix", name: "Minced beef-pork mix", cat: "Meat & Fish", type: "solid", kcal: 258, fat: 21, carbs: 0, fiber: 0, protein: 17 },
  { id: "df-beef-steak-lean", name: "Beef steak (lean)", cat: "Meat & Fish", type: "solid", kcal: 150, fat: 7, carbs: 0, fiber: 0, protein: 21 },
  { id: "df-pork-loin", name: "Pork loin", cat: "Meat & Fish", type: "solid", kcal: 145, fat: 6, carbs: 0, fiber: 0, protein: 21 },
  { id: "df-pork-shoulder", name: "Pork shoulder", cat: "Meat & Fish", type: "solid", kcal: 215, fat: 16, carbs: 0, fiber: 0, protein: 17 },
  { id: "df-bacon", name: "Bacon", cat: "Meat & Fish", type: "solid", kcal: 420, fat: 42, carbs: 0.7, fiber: 0, protein: 13 },
  { id: "df-pork-sausages", name: "Pork sausages", cat: "Meat & Fish", type: "solid", kcal: 320, fat: 28, carbs: 1.5, fiber: 0, protein: 14 },
  { id: "df-ham", name: "Ham", cat: "Meat & Fish", type: "solid", kcal: 115, fat: 4.5, carbs: 1.5, fiber: 0, protein: 17 },
  { id: "df-salami", name: "Salami", cat: "Meat & Fish", type: "solid", kcal: 380, fat: 32, carbs: 2, fiber: 0, protein: 21 },
  { id: "df-canned-tuna-in-brine", name: "Canned tuna (in brine)", cat: "Meat & Fish", type: "solid", kcal: 110, fat: 1, carbs: 0, fiber: 0, protein: 25 },
  { id: "df-salmon", name: "Salmon", cat: "Meat & Fish", type: "solid", kcal: 208, fat: 13, carbs: 0, fiber: 0, protein: 20 },
  { id: "df-white-fish-cod", name: "White fish (cod)", cat: "Meat & Fish", type: "solid", kcal: 82, fat: 0.7, carbs: 0, fiber: 0, protein: 18 },

  // Dairy & Eggs
  { id: "df-eggs", name: "Eggs", cat: "Dairy & Eggs", type: "solid", kcal: 143, fat: 9.5, carbs: 0.7, fiber: 0, protein: 12.6 },
  { id: "df-whole-milk-3-5", name: "Whole milk (3.5%)", cat: "Dairy & Eggs", type: "solid", kcal: 64, fat: 3.5, carbs: 4.8, fiber: 0, protein: 3.3 },
  { id: "df-butter", name: "Butter", cat: "Dairy & Eggs", type: "solid", kcal: 717, fat: 81, carbs: 0.6, fiber: 0, protein: 0.9 },
  { id: "df-plain-yogurt-whole", name: "Plain yogurt (whole)", cat: "Dairy & Eggs", type: "solid", kcal: 61, fat: 3.3, carbs: 4.7, fiber: 0, protein: 3.5 },
  { id: "df-greek-yogurt-5", name: "Greek yogurt (5%)", cat: "Dairy & Eggs", type: "solid", kcal: 95, fat: 5, carbs: 3.8, fiber: 0, protein: 9 },
  { id: "df-kefir", name: "Kefir", cat: "Dairy & Eggs", type: "solid", kcal: 55, fat: 3, carbs: 4.5, fiber: 0, protein: 3.3 },
  { id: "df-sour-cream-20", name: "Sour cream (20%)", cat: "Dairy & Eggs", type: "solid", kcal: 200, fat: 20, carbs: 3.5, fiber: 0, protein: 2.5 },
  { id: "df-cottage-cheese", name: "Cottage cheese", cat: "Dairy & Eggs", type: "solid", kcal: 98, fat: 4.3, carbs: 3.4, fiber: 0, protein: 11 },
  { id: "df-feta", name: "Feta", cat: "Dairy & Eggs", type: "solid", kcal: 265, fat: 21, carbs: 4, fiber: 0, protein: 14 },
  { id: "df-yellow-cheese-gouda-style", name: "Yellow cheese (Gouda-style)", cat: "Dairy & Eggs", type: "solid", kcal: 356, fat: 27, carbs: 2.2, fiber: 0, protein: 25 },
  { id: "df-mozzarella", name: "Mozzarella", cat: "Dairy & Eggs", type: "solid", kcal: 300, fat: 22, carbs: 2.2, fiber: 0, protein: 22 },
  { id: "df-parmesan", name: "Parmesan", cat: "Dairy & Eggs", type: "solid", kcal: 392, fat: 26, carbs: 3.2, fiber: 0, protein: 36 },
  { id: "df-cheddar", name: "Cheddar", cat: "Dairy & Eggs", type: "solid", kcal: 403, fat: 33, carbs: 1.3, fiber: 0, protein: 25 },

  // Fruits
  { id: "df-apples", name: "Apples", cat: "Fruits", type: "solid", kcal: 52, fat: 0.2, carbs: 14, fiber: 2.4, protein: 0.3 },
  { id: "df-bananas", name: "Bananas", cat: "Fruits", type: "solid", kcal: 89, fat: 0.3, carbs: 23, fiber: 2.6, protein: 1.1 },
  { id: "df-oranges", name: "Oranges", cat: "Fruits", type: "solid", kcal: 47, fat: 0.1, carbs: 12, fiber: 2.4, protein: 0.9 },
  { id: "df-lemons", name: "Lemons", cat: "Fruits", type: "solid", kcal: 29, fat: 0.3, carbs: 9.3, fiber: 2.8, protein: 1.1 },
  { id: "df-plums", name: "Plums", cat: "Fruits", type: "solid", kcal: 46, fat: 0.3, carbs: 11.4, fiber: 1.4, protein: 0.7 },
  { id: "df-grapes", name: "Grapes", cat: "Fruits", type: "solid", kcal: 69, fat: 0.2, carbs: 18, fiber: 0.9, protein: 0.7 },
  { id: "df-cherries", name: "Cherries", cat: "Fruits", type: "solid", kcal: 63, fat: 0.2, carbs: 16, fiber: 2.1, protein: 1.1 },
  { id: "df-strawberries", name: "Strawberries", cat: "Fruits", type: "solid", kcal: 32, fat: 0.3, carbs: 7.7, fiber: 2, protein: 0.7 },
  { id: "df-raspberries", name: "Raspberries", cat: "Fruits", type: "solid", kcal: 52, fat: 0.7, carbs: 12, fiber: 6.5, protein: 1.2 },
  { id: "df-watermelon", name: "Watermelon", cat: "Fruits", type: "solid", kcal: 30, fat: 0.2, carbs: 7.6, fiber: 0.4, protein: 0.6 },
  { id: "df-peaches", name: "Peaches", cat: "Fruits", type: "solid", kcal: 39, fat: 0.3, carbs: 9.5, fiber: 1.5, protein: 0.9 },
  { id: "df-pears", name: "Pears", cat: "Fruits", type: "solid", kcal: 57, fat: 0.1, carbs: 15, fiber: 3.1, protein: 0.4 },
  { id: "df-avocado", name: "Avocado", cat: "Fruits", type: "solid", kcal: 160, fat: 14.7, carbs: 8.5, fiber: 6.7, protein: 2 },

  // Grains & Bread
  { id: "df-white-bread", name: "White bread", cat: "Grains & Bread", type: "solid", kcal: 265, fat: 3.2, carbs: 49, fiber: 2.7, protein: 9 },
  { id: "df-wholemeal-bread", name: "Wholemeal bread", cat: "Grains & Bread", type: "solid", kcal: 250, fat: 3.5, carbs: 41, fiber: 7, protein: 13 },
  { id: "df-white-rice-dry", name: "White rice (dry)", cat: "Grains & Bread", type: "solid", kcal: 360, fat: 0.6, carbs: 79, fiber: 1.3, protein: 7 },
  { id: "df-pasta-dry", name: "Pasta (dry)", cat: "Grains & Bread", type: "solid", kcal: 371, fat: 1.5, carbs: 75, fiber: 3.2, protein: 13 },
  { id: "df-cornmeal-dry", name: "Cornmeal (dry)", cat: "Grains & Bread", type: "solid", kcal: 365, fat: 2, carbs: 78, fiber: 4, protein: 8 },
  { id: "df-rolled-oats", name: "Rolled oats", cat: "Grains & Bread", type: "solid", kcal: 379, fat: 6.5, carbs: 67, fiber: 10, protein: 13 },
  { id: "df-white-wheat-flour", name: "White wheat flour", cat: "Grains & Bread", type: "solid", kcal: 364, fat: 1, carbs: 76, fiber: 2.7, protein: 10 },
  { id: "df-muesli", name: "Muesli", cat: "Grains & Bread", type: "solid", kcal: 360, fat: 6, carbs: 66, fiber: 8, protein: 10 },
  { id: "df-wheat-tortillas", name: "Wheat tortillas", cat: "Grains & Bread", type: "solid", kcal: 310, fat: 8, carbs: 50, fiber: 3, protein: 8.5 },

  // Fats & Condiments
  { id: "df-sunflower-oil", name: "Sunflower oil", cat: "Fats & Condiments", type: "solid", kcal: 884, fat: 100, carbs: 0, fiber: 0, protein: 0 },
  { id: "df-olive-oil", name: "Olive oil", cat: "Fats & Condiments", type: "solid", kcal: 884, fat: 100, carbs: 0, fiber: 0, protein: 0 },
  { id: "df-lard", name: "Lard", cat: "Fats & Condiments", type: "solid", kcal: 900, fat: 100, carbs: 0, fiber: 0, protein: 0 },
  { id: "df-sugar", name: "Sugar", cat: "Fats & Condiments", type: "solid", kcal: 400, fat: 0, carbs: 100, fiber: 0, protein: 0 },
  { id: "df-honey", name: "Honey", cat: "Fats & Condiments", type: "solid", kcal: 304, fat: 0, carbs: 82, fiber: 0.2, protein: 0.3 },
  { id: "df-jam", name: "Jam", cat: "Fats & Condiments", type: "solid", kcal: 250, fat: 0.1, carbs: 62, fiber: 1, protein: 0.4 },
  { id: "df-milk-chocolate", name: "Milk chocolate", cat: "Fats & Condiments", type: "solid", kcal: 535, fat: 30, carbs: 59, fiber: 3.4, protein: 7.7 },
  { id: "df-mustard", name: "Mustard", cat: "Fats & Condiments", type: "solid", kcal: 66, fat: 4, carbs: 6, fiber: 3, protein: 4 },
  { id: "df-ketchup", name: "Ketchup", cat: "Fats & Condiments", type: "solid", kcal: 100, fat: 0.2, carbs: 25, fiber: 0.3, protein: 1 },
  { id: "df-mayonnaise", name: "Mayonnaise", cat: "Fats & Condiments", type: "solid", kcal: 680, fat: 75, carbs: 1, fiber: 0, protein: 1 },

  // Beverages
  { id: "df-beer-lager-5", name: "Beer (lager, 5%)", cat: "Beverages", type: "liquid", kcal: 43, fat: 0, carbs: 3.6, fiber: 0, protein: 0.5 },
  { id: "df-wine-dry-red", name: "Wine (dry red)", cat: "Beverages", type: "liquid", kcal: 85, fat: 0, carbs: 2.6, fiber: 0, protein: 0.1 },
  { id: "df-plum-brandy-45", name: "Plum brandy (45%)", cat: "Beverages", type: "liquid", kcal: 250, fat: 0, carbs: 0, fiber: 0, protein: 0 },
  { id: "df-cola-regular", name: "Cola (regular)", cat: "Beverages", type: "liquid", kcal: 42, fat: 0, carbs: 10.6, fiber: 0, protein: 0 },
  { id: "df-energy-drink-regular", name: "Energy drink (regular)", cat: "Beverages", type: "liquid", kcal: 46, fat: 0, carbs: 11, fiber: 0, protein: 0 },

  // Nuts & Seeds
  { id: "df-walnuts", name: "Walnuts", cat: "Nuts & Seeds", type: "solid", kcal: 654, fat: 65, carbs: 14, fiber: 6.7, protein: 15 },
  { id: "df-sunflower-seeds", name: "Sunflower seeds", cat: "Nuts & Seeds", type: "solid", kcal: 584, fat: 51, carbs: 20, fiber: 8.6, protein: 21 },
  { id: "df-almonds", name: "Almonds", cat: "Nuts & Seeds", type: "solid", kcal: 579, fat: 50, carbs: 22, fiber: 12.5, protein: 21 },
  { id: "df-peanut-butter", name: "Peanut butter", cat: "Nuts & Seeds", type: "solid", kcal: 588, fat: 50, carbs: 20, fiber: 6, protein: 25 },
  { id: "df-pumpkin-seeds", name: "Pumpkin seeds", cat: "Nuts & Seeds", type: "solid", kcal: 559, fat: 49, carbs: 11, fiber: 6, protein: 30 },

  // Legumes
  { id: "df-white-beans-dry", name: "White beans (dry)", cat: "Legumes", type: "solid", kcal: 333, fat: 0.9, carbs: 60, fiber: 15, protein: 23 },
  { id: "df-chickpeas-dry", name: "Chickpeas (dry)", cat: "Legumes", type: "solid", kcal: 364, fat: 6, carbs: 61, fiber: 17, protein: 19 },
  { id: "df-lentils-dry", name: "Lentils (dry)", cat: "Legumes", type: "solid", kcal: 352, fat: 1, carbs: 63, fiber: 11, protein: 25 },
  { id: "df-kidney-beans-dry", name: "Kidney beans (dry)", cat: "Legumes", type: "solid", kcal: 333, fat: 0.8, carbs: 60, fiber: 15, protein: 24 },
];
