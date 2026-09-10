/**
 * Nomes de exibição formais para exercícios padrão (es/en), chaveados por
 * `id` — nunca por `name`, que continua em pt-BR como valor canônico usado
 * em storage/matching (ex.: parser de "Treino Por Extenso", Firestore).
 * pt-BR não tem entrada aqui: cai no fallback (ex.name) em useExerciseName.
 * Exercícios criados pelo usuário/PT (ids fora deste mapa) também caem no
 * fallback em qualquer locale — só o banco padrão tem tradução formal.
 * Terminologia revisada pra evitar tradução literal/gíria (ex.: "Skull
 * Crusher" → "Lying Triceps Extension"; "hundir" → "Estocada").
 */
export const EXERCISE_NAMES: Record<string, { es: string; en: string }> = {
  // Peito / Chest
  e1: { es: 'Press de Banca con Barra', en: 'Barbell Bench Press' },
  e2: { es: 'Press Inclinado con Mancuernas', en: 'Incline Dumbbell Press' },
  e3: { es: 'Press con Mancuernas Agarre Neutro', en: 'Neutral-Grip Dumbbell Press' },
  e4: { es: 'Aperturas con Mancuernas', en: 'Flat Dumbbell Fly' },
  e5: { es: 'Aperturas en Máquina', en: 'Machine Chest Fly' },
  e6: { es: 'Cruce de Poleas', en: 'Cable Crossover' },
  e7: { es: 'Flexiones de Brazos', en: 'Push-Up' },
  e47: { es: 'Press de Banca Declinado', en: 'Barbell Decline Bench Press' },
  e48: { es: 'Aperturas Inclinadas con Mancuernas', en: 'Incline Dumbbell Fly' },
  e49: { es: 'Peck Deck (Contractora)', en: 'Pec Deck Fly' },
  e50: { es: 'Press de Banca en Máquina', en: 'Machine Chest Press' },
  e51: { es: 'Flexiones Diamante', en: 'Diamond Push-Up' },
  e52: { es: 'Cruce de Poleas Bajas (Pecho Superior)', en: 'Low-Cable Crossover (Upper Chest)' },

  // Costas / Back
  e8: { es: 'Jalón al Pecho', en: 'Lat Pulldown' },
  e9: { es: 'Remo con Barra Inclinado', en: 'Bent-Over Barbell Row' },
  e10: { es: 'Remo Unilateral con Mancuerna', en: 'Single-Arm Dumbbell Row' },
  e11: { es: 'Peso Muerto', en: 'Deadlift' },
  e12: { es: 'Dominadas', en: 'Pull-Up' },
  e13: { es: 'Remo en Máquina', en: 'Machine Row' },
  e53: { es: 'Jalón Agarre Triángulo', en: 'Close-Grip Triangle Pulldown' },
  e54: { es: 'Remo en T', en: 'T-Bar Row' },
  e55: { es: 'Jalón Agarre Supino', en: 'Underhand-Grip Pulldown' },
  e56: { es: 'Remo Bajo en Polea', en: 'Seated Cable Row' },
  e57: { es: 'Pull-Over en Polea Alta', en: 'High-Cable Pullover' },
  e58: { es: 'Encogimiento de Hombros', en: 'Shrug' },

  // Quadríceps / Quads
  e14: { es: 'Sentadilla Libre', en: 'Barbell Back Squat' },
  e15: { es: 'Prensa de Piernas 45°', en: '45° Leg Press' },
  e16: { es: 'Extensión de Piernas', en: 'Leg Extension' },
  e17: { es: 'Sentadilla Hack', en: 'Hack Squat' },
  e18: { es: 'Estocada', en: 'Forward Lunge' },
  e59: { es: 'Sentadilla Frontal', en: 'Front Squat' },
  e60: { es: 'Sentadilla Búlgara', en: 'Bulgarian Split Squat' },
  e61: { es: 'Step-Up con Mancuernas', en: 'Dumbbell Step-Up' },
  e62: { es: 'Sentadilla en Multipower', en: 'Smith Machine Squat' },

  // Isquiotibiais / Hamstrings
  e19: { es: 'Curl Femoral Acostado', en: 'Lying Leg Curl' },
  e20: { es: 'Peso Muerto Rígido (Stiff)', en: 'Stiff-Leg Deadlift' },
  e22: { es: 'Curl Femoral de Pie', en: 'Standing Leg Curl' },
  e63: { es: 'Peso Muerto Rumano', en: 'Romanian Deadlift' },
  e64: { es: 'Elevación Glúteo-Femoral', en: 'Glute-Ham Raise' },

  // Glúteos / Glutes
  e21: { es: 'Empuje de Cadera (Hip Thrust)', en: 'Hip Thrust' },
  e23: { es: 'Máquina de Abducción de Cadera', en: 'Hip Abduction Machine' },
  e65: { es: 'Patada de Glúteo en Polea', en: 'Cable Glute Kickback' },
  e66: { es: 'Sentadilla Sumo con Mancuerna', en: 'Dumbbell Sumo Squat' },

  // Ombros / Shoulders
  e24: { es: 'Press Arnold', en: 'Arnold Press' },
  e25: { es: 'Press de Hombros en Máquina', en: 'Machine Shoulder Press' },
  e26: { es: 'Elevación Lateral', en: 'Lateral Raise' },
  e27: { es: 'Elevación Frontal', en: 'Front Raise' },
  e28: { es: 'Jalón a la Cara (Face Pull)', en: 'Face Pull' },
  e67: { es: 'Press Militar con Barra', en: 'Barbell Overhead Press' },
  e68: { es: 'Remo al Mentón', en: 'Upright Row' },
  e69: { es: 'Aperturas Invertidas (Reverse Fly)', en: 'Reverse Fly' },
  e70: { es: 'Elevación Lateral en Polea', en: 'Cable Lateral Raise' },

  // Bíceps / Biceps
  e29: { es: 'Curl de Bíceps con Barra', en: 'Barbell Bicep Curl' },
  e30: { es: 'Curl Alternado con Mancuernas', en: 'Alternating Dumbbell Curl' },
  e31: { es: 'Curl Martillo', en: 'Hammer Curl' },
  e32: { es: 'Curl Concentrado', en: 'Concentration Curl' },
  e71: { es: 'Curl en Banco Scott', en: 'Preacher Curl' },
  e72: { es: 'Curl de Bíceps en Polea', en: 'Cable Bicep Curl' },
  e73: { es: 'Curl Invertido', en: 'Reverse Curl' },
  e74: { es: 'Curl 21', en: '21s Bicep Curl' },

  // Tríceps / Triceps
  e33: { es: 'Extensión de Tríceps en Polea (Cuerda)', en: 'Rope Triceps Pushdown' },
  e34: { es: 'Extensión de Tríceps en Banco', en: 'Lying Triceps Extension' },
  e35: { es: 'Extensión de Tríceps sobre Cabeza', en: 'Overhead Triceps Extension' },
  e36: { es: 'Fondos de Tríceps en Máquina', en: 'Machine Triceps Dip' },
  e75: { es: 'Patada de Tríceps (Kickback)', en: 'Triceps Kickback' },
  e76: { es: 'Extensión de Tríceps Agarre Invertido', en: 'Reverse-Grip Triceps Pushdown' },
  e77: { es: 'Fondos en Banco', en: 'Bench Dip' },
  e78: { es: 'Fondos en Paralelas', en: 'Dip' },

  // Panturrilhas / Calves
  e37: { es: 'Elevación de Talones de Pie', en: 'Standing Calf Raise' },
  e38: { es: 'Elevación de Talones Sentado', en: 'Seated Calf Raise' },
  e79: { es: 'Elevación de Talones en Prensa', en: 'Leg Press Calf Raise' },
  e80: { es: 'Elevación de Talones Burro (Donkey)', en: 'Donkey Calf Raise' },

  // Abdômen / Abs
  e39: { es: 'Encogimiento Abdominal (Crunch)', en: 'Crunch' },
  e41: { es: 'Giro Ruso (Russian Twist)', en: 'Russian Twist' },
  e42: { es: 'Elevación de Piernas Abdominal', en: 'Lower Ab Leg Raise' },
  e81: { es: 'Elevación de Piernas Colgado', en: 'Hanging Leg Raise' },
  e82: { es: 'Encogimiento en Polea (Cable Crunch)', en: 'Cable Crunch' },
  e83: { es: 'Plancha Lateral', en: 'Side Plank' },

  // Extensores da Coluna / Spinal Erectors
  e40: { es: 'Plancha Isométrica', en: 'Plank' },
  e43: { es: 'Press Pallof', en: 'Pallof Press' },
  e44: { es: 'Hiperextensión Lumbar', en: 'Back Extension' },
  e45: { es: 'Bird Dog (Perro de Caza)', en: 'Bird Dog' },
  e46: { es: 'Buenos Días (Good Morning)', en: 'Good Morning' },
  e84: { es: 'Superman', en: 'Superman' },

  // Cardio
  c1: { es: 'Cinta de Correr (Carrera)', en: 'Treadmill (Running)' },
  c2: { es: 'Cinta de Correr (Caminata)', en: 'Treadmill (Walking)' },
  c3: { es: 'Bicicleta Estática', en: 'Stationary Bike' },
  c4: { es: 'Elíptica', en: 'Elliptical Trainer' },
  c5: { es: 'Escaladora (StairMaster)', en: 'Stair Climber' },
  c6: { es: 'Remoergómetro', en: 'Rowing Machine' },
  c7: { es: 'Saltar la Cuerda', en: 'Jump Rope' },
  c8: { es: 'Natación', en: 'Swimming' },
  c9: { es: 'HIIT Funcional', en: 'Functional HIIT' },
  c10: { es: 'Ciclismo al Aire Libre', en: 'Outdoor Cycling' },
  c11: { es: 'Carrera al Aire Libre', en: 'Outdoor Running' },
};
