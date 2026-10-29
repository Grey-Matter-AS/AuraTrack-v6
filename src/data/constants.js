export const SYMPTOM_WIZARD = {
  "Physical Movement": {
    "Small Twitching": {
      skipRegion: false,
      options: [
        { label: "Muscle Flickering", med: "Fasciculation" },
        { label: "Single Muscle Jerks", med: "Myoclonic jerks" },
        { label: "Muscle Rippling", med: "Myokymia" },
        { label: "Eye/Lid Twitching", med: "Eyelid myoclonia", forceRegion: "Head & Face", forceSubRegion: "Eyes" }
      ]
    },
    "Big Shaking/Jerking": {
      skipRegion: false,
      options: [
        { label: "Rhythmic Shaking", med: "Clonic activity" },
        { label: "Violent Jolts", med: "Myoclonus" },
        { label: "Large Trembling", med: "Tremor" },
        { label: "Bicycling/Kicking legs", med: "Pedaling", forceRegion: "Legs", forceSubRegion: "General Legs" }
      ]
    },
    "Stiffening/Locking": {
      skipRegion: false,
      options: [
        { label: "Body gone rigid", med: "Tonic posturing", forceRegion: "Whole Body", forceSubRegion: "General" },
        { label: "Specific limb locked", med: "Focal Tonic" },
        { label: "Jaw Clenched/Locked", med: "Trismus", forceRegion: "Head & Face", forceSubRegion: "Mouth" },
        { label: "Arching Back", med: "Opisthotonus", forceRegion: "Torso", forceSubRegion: "Front/Back" }
      ]
    },
    "Losing Control": {
      skipRegion: false,
      options: [
        { label: "Going Limp/Dropping", med: "Atonic event" },
        { label: "Head Dropping Forward", med: "Head drop", forceRegion: "Head & Face", forceSubRegion: "Other" },
        { label: "Slumping to one side", med: "Lateral tilt" },
        { label: "Sudden Fall", med: "Drop attack", forceRegion: "Whole Body", forceSubRegion: "General" }
      ]
    },
    "Automatic Habits": {
      skipRegion: true,
      options: [
        { label: "Lip Smacking/Chewing", med: "Orofacial automatisms" },
        { label: "Fidgeting with clothes", med: "Manual automatisms" },
        { label: "Wandering/Pacing", med: "Ambulatory automatisms" },
        { label: "Repeating a gesture", med: "Gestural automatisms" }
      ]
    }
  },
  "Sensory & Vision": {
    "Skin Sensation": {
      skipRegion: false,
      options: [
        { label: "Tingling/Pins & Needles", med: "Paresthesia" },
        { label: "Numbness", med: "Sensory deficit" },
        { label: "Hot or Cold Flash", med: "Thermal aura" },
        { label: "Electric Shock feeling", med: "Somatosensory aura" }
      ]
    },
    "Vision/Eyes": {
      skipRegion: true,
      options: [
        { label: "Flashing Lights/Colors", med: "Visual hallucinations" },
        { label: "Blurred/Loss of vision", med: "Amaurosis" },
        { label: "Things look bigger/smaller", med: "Metamorphopsia" },
        { label: "Seeing double", med: "Diplopia" }
      ]
    },
    "Hearing & Smell": {
      skipRegion: true,
      options: [
        { label: "Strange Smell", med: "Olfactory aura" },
        { label: "Strange Taste", med: "Gustatory aura" },
        { label: "Muffled/Ring sounds", med: "Auditory aura" },
        { label: "Noises sound too loud", med: "Hyperacusis" }
      ]
    }
  },
  "Internal & Autonomic": {
    "Stomach & Chest": {
      skipRegion: true,
      options: [
        { label: "Rising 'Butterfly' feeling", med: "Epigastric aura" },
        { label: "Racing Heart", med: "Tachycardia" },
        { label: "Nausea/Sick feeling", med: "Autonomic aura" },
        { label: "Hard to breathe", med: "Dyspnea" }
      ]
    },
    "Skin & Temperature": {
      skipRegion: true,
      options: [
        { label: "Sudden Sweating", med: "Diaphoresis" },
        { label: "Goosebumps", med: "Piloerection" },
        { label: "Turned Pale", med: "Pallor" },
        { label: "Turned Blue/Purple", med: "Cyanosis" },
        { label: "Face Flushing Red", med: "Flushing" }
      ]
    }
  },
  "Head & Face": {
    "Face & Mouth": {
      skipRegion: false,
      options: [
        { label: "Drooling", med: "Sialorrhea", forceRegion: "Head & Face", forceSubRegion: "Mouth" },
        { label: "Face pulling to side", med: "Versive face", forceRegion: "Head & Face", forceSubRegion: "Cheeks" },
        { label: "Unable to swallow", med: "Dysphagia", forceRegion: "Head & Face", forceSubRegion: "Mouth" },
        { label: "Tongue Biting", med: "Lateral tongue trauma", forceRegion: "Head & Face", forceSubRegion: "Mouth" }
      ]
    },
    "Eyes": {
      skipRegion: false,
      options: [
        { label: "Staring Blankly", med: "Behavioral arrest", forceRegion: "Head & Face", forceSubRegion: "Eyes" },
        { label: "Eyes rolling up", med: "Oculogyric crisis", forceRegion: "Head & Face", forceSubRegion: "Eyes" },
        { label: "Rapid Blinking", med: "Eyelid myoclonia", forceRegion: "Head & Face", forceSubRegion: "Eyes" },
        { label: "Eyes pulled to side", med: "Versive gaze", forceRegion: "Head & Face", forceSubRegion: "Eyes" },
        { label: "Dilated pupils", med: "Mydriasis", forceRegion: "Head & Face", forceSubRegion: "Eyes" }
      ]
    }
  },
  "Mental & Speech": {
    "Awareness": {
      skipRegion: true,
      options: [
        { label: "Fully Awake/Aware", med: "Focal Aware" },
        { label: "Confused/Dream-like", med: "Focal Impaired Awareness" },
        { label: "Total Blackout", med: "Generalized" }
      ]
    },
    "Talking": {
      skipRegion: true,
      options: [
        { label: "Slurred Speech", med: "Dysarthria" },
        { label: "Mumbled/Nonsense", med: "Dysphasia" },
        { label: "Unable to speak", med: "Aphasia" },
        { label: "Repeating words", med: "Palilalia" }
      ]
    },
    "Emotions/Memory": {
      skipRegion: true,
      options: [
        { label: "Deja Vu (Been here before)", med: "Deja Vu" },
        { label: "Strange Unfamiliarity", med: "Jamais Vu" },
        { label: "Sudden Fear/Panic", med: "Ictal fear" },
        { label: "Sudden Laughter", med: "Gelastic" },
        { label: "Intense Peace/Joy", med: "Ecstatic" }
      ]
    }
  }
};

export const REGION_WIZARD = {
  "Whole Body": {
    "General": ["Both Sides Equally", "Starts one side -> Spreads", "Alternating Sides"]
  },
  "Head & Face": {
    "Eyes": ["Left Eye", "Right Eye", "Both Eyes"],
    "Mouth": ["Left Side", "Right Side", "Full Mouth", "Tongue"],
    "Cheeks": ["Left Cheek", "Right Cheek", "Both Cheeks"],
    "Other": ["Back of Head", "Top of Head", "Neck"]
  },
  "Arms": {
    "Left Arm": ["Whole Arm", "Shoulder", "Upper Arm", "Elbow", "Wrist", "Hand/Fingers"],
    "Right Arm": ["Whole Arm", "Shoulder", "Upper Arm", "Elbow", "Wrist", "Hand/Fingers"]
  },
  "Legs": {
    "General Legs": ["Both Legs", "Starts Left -> Both", "Starts Right -> Both"],
    "Left Leg": ["Whole Leg", "Hip/Thigh", "Knee", "Ankle", "Foot/Toes"],
    "Right Leg": ["Whole Leg", "Hip/Thigh", "Knee", "Ankle", "Foot/Toes"]
  },
  "Torso": {
    "Front/Back": ["Whole Torso", "Chest Area", "Stomach Area", "Upper Back", "Lower Back"]
  }
};

export const SEIZURE_TYPES = [
  'Tonic-Clonic',
  'Focal Aware',
  'Focal Impaired',
  'Absence',
  'Aura Only'
];

export const TRIGGERS = [
  'Sleep Deprivation',
  'Missed Medication',
  'Stress',
  'Illness / Fever',
  'Hormonal',
  'Alcohol',
  'Flashing Lights',
  'Heat / Overheating',
  'Exercise',
  'Hunger / Low Blood Sugar',
  'Unknown',
];

export const EEG_MOOD_OPTIONS = [
  'Calm',
  'Anxious',
  'Stressed',
  'Irritable',
  'Sad',
  'Tearful',
  'Elevated',
  'Agitated',
  'Fatigued',
  'Sleepy',
  'Alert',
  'Distracted',
  'Overwhelmed',
  'Frustrated',
  'Fearful',
  'Apathetic',
  'Restless',
  'Content',
  'Confused',
  'Emotionally Flat',
];

export const WELLBEING_MOOD_OPTIONS = [
  { label: 'Happy', labelKey: 'wellbeing.moods.happy_label', help: 'Positive mood, cheerful, enjoying things.', helpKey: 'wellbeing.moods.happy_help' },
  { label: 'Calm', labelKey: 'wellbeing.moods.calm_label', help: 'Settled, peaceful, not tense.', helpKey: 'wellbeing.moods.calm_help' },
  { label: 'Content', labelKey: 'wellbeing.moods.content_label', help: 'Okay or satisfied, comfortable with things as they are.', helpKey: 'wellbeing.moods.content_help' },
  { label: 'Sad / Low', labelKey: 'wellbeing.moods.sad_low_label', help: 'Down, unhappy, withdrawn, or less interested than usual.', helpKey: 'wellbeing.moods.sad_low_help' },
  { label: 'Anxious / Worried', labelKey: 'wellbeing.moods.anxious_worried_label', help: 'Nervous, fearful, or expecting something bad.', helpKey: 'wellbeing.moods.anxious_worried_help' },
  { label: 'Stressed / Overloaded', labelKey: 'wellbeing.moods.stressed_overloaded_label', help: 'Under pressure, too much happening, hard to cope.', helpKey: 'wellbeing.moods.stressed_overloaded_help' },
  { label: 'Irritable / Angry', labelKey: 'wellbeing.moods.irritable_angry_label', help: 'Easily annoyed, short-tempered, or angry.', helpKey: 'wellbeing.moods.irritable_angry_help' },
  { label: 'Restless / Agitated', labelKey: 'wellbeing.moods.restless_agitated_label', help: 'Unable to settle, pacing, keyed up, or visibly activated.', helpKey: 'wellbeing.moods.restless_agitated_help' },
  { label: 'Tired / Sleepy', labelKey: 'wellbeing.moods.tired_sleepy_label', help: 'Low energy, drowsy, or wanting to sleep.', helpKey: 'wellbeing.moods.tired_sleepy_help' },
  { label: 'Confused', labelKey: 'wellbeing.moods.confused_label', help: 'Disoriented, unclear, or having trouble following what is happening.', helpKey: 'wellbeing.moods.confused_help' },
  { label: 'Emotionally Flat', labelKey: 'wellbeing.moods.emotionally_flat_label', help: 'Little visible emotion or reduced response.', helpKey: 'wellbeing.moods.emotionally_flat_help' },
  { label: 'Very Happy / Euphoric', labelKey: 'wellbeing.moods.very_happy_euphoric_label', help: 'Unusually high, excited, or intensely positive mood.', helpKey: 'wellbeing.moods.very_happy_euphoric_help' },
];

export const DEFAULT_WELLBEING_FACTORS = [
  { id: 'sleepHours', label: 'Sleep hours', labelKey: 'wellbeing.factors.sleep_hours_label', type: 'number', unit: 'h', help: 'Approximate hours slept since the last check-in.', helpKey: 'wellbeing.factors.sleep_hours_help', active: true },
  { id: 'sleepQuality', label: 'Sleep quality', labelKey: 'wellbeing.factors.sleep_quality_label', type: 'scale', unit: '', help: 'How restful the sleep seemed.', helpKey: 'wellbeing.factors.sleep_quality_help', active: true, scaleLabels: ['Poor', 'Fair', 'Good', 'Restful'], scaleLabelKeys: ['wellbeing.factors.sleep_quality_poor', 'wellbeing.factors.sleep_quality_fair', 'wellbeing.factors.sleep_quality_good', 'wellbeing.factors.sleep_quality_restful'], saveZero: true },
  { id: 'sleeplessness', label: 'Sleeplessness', labelKey: 'wellbeing.factors.sleeplessness_label', type: 'boolean', unit: '', help: 'Long awake periods, very delayed sleep, or very broken sleep.', helpKey: 'wellbeing.factors.sleeplessness_help', active: true },
  { id: 'missedBowelMovement', label: 'Missed bowel movement', labelKey: 'wellbeing.factors.missed_bowel_movement_label', type: 'boolean', unit: '', help: 'No bowel movement when one was expected for the person.', helpKey: 'wellbeing.factors.missed_bowel_movement_help', active: true },
  { id: 'stress', label: 'Stress', labelKey: 'wellbeing.factors.stress_label', type: 'scale', unit: '', help: 'Pressure, overload, conflict, or demanding events.', helpKey: 'wellbeing.factors.stress_help', active: true },
  { id: 'illnessFever', label: 'Illness / fever', labelKey: 'wellbeing.factors.illness_fever_label', type: 'boolean', unit: '', help: 'Signs of illness, infection, fever, or feeling unwell.', helpKey: 'wellbeing.factors.illness_fever_help', active: true },
  { id: 'missedMedication', label: 'Missed medication', labelKey: 'wellbeing.factors.missed_medication_label', type: 'boolean', unit: '', help: 'Any scheduled medicine was missed or significantly delayed.', helpKey: 'wellbeing.factors.missed_medication_help', active: true },
  { id: 'hormonalMenstruation', label: 'Hormonal / menstruation', labelKey: 'wellbeing.factors.hormonal_menstruation_label', type: 'boolean', unit: '', help: 'Menstruation, hormonal changes, or suspected cycle-related symptoms.', helpKey: 'wellbeing.factors.hormonal_menstruation_help', active: true },
  { id: 'unusualActivity', label: 'Unusual activity', labelKey: 'wellbeing.factors.unusual_activity_label', type: 'boolean', unit: '', help: 'A day that was more active, different, or stimulating than usual.', helpKey: 'wellbeing.factors.unusual_activity_help', active: true },
  { id: 'tearfulCrying', label: 'Tearful / crying', labelKey: 'wellbeing.factors.tearful_crying_label', type: 'boolean', unit: '', help: 'Crying or visibly tearful, whether or not the person could describe why.', helpKey: 'wellbeing.factors.tearful_crying_help', active: true },
];

export const EEG_ACTIVITY_OPTIONS = [
  'Sleeping',
  'Resting',
  'Lying down',
  'Napping',
  'Waking up',
  'Getting out of bed',
  'Eating breakfast',
  'Eating lunch',
  'Eating dinner',
  'Snacking',
  'Drinking water',
  'Drinking coffee',
  'Drinking tea',
  'Cooking',
  'Baking',
  'Brushing teeth',
  'Showering',
  'Bathing',
  'Washing hair',
  'Getting dressed',
  'Undressing',
  'Using the bathroom',
  'Taking medication',
  'Walking indoors',
  'Walking outdoors',
  'Hiking',
  'Jogging',
  'Running',
  'Cycling',
  'Stretching',
  'Yoga',
  'Exercise',
  'Gym workout',
  'Strength training',
  'Cleaning',
  'Laundry',
  'Dishwashing',
  'Vacuuming',
  'Gardening',
  'Shopping',
  'Driving',
  'Riding in a car',
  'Bus travel',
  'Train travel',
  'Air travel',
  'Commuting',
  'Working at desk',
  'Working from home',
  'Office work',
  'Manual labor',
  'Studying',
  'Attending class',
  'Reading',
  'Writing',
  'Typing',
  'Using computer',
  'Using phone',
  'Video call',
  'Phone call',
  'Texting',
  'Watching TV',
  'Watching movie',
  'Watching video',
  'Listening to music',
  'Listening to podcast',
  'Gaming',
  'Drawing',
  'Painting',
  'Pottery',
  'Crafts',
  'Knitting',
  'Sewing',
  'Photography',
  'Playing instrument',
  'Singing',
  'Dancing',
  'Meditating',
  'Praying',
  'Socializing',
  'Talking with family',
  'Talking with friends',
  'Childcare',
  'Pet care',
  'Feeding pet',
  'Walking dog',
  'Eating out',
  'Restaurant visit',
  'Appointment',
  'Hospital visit',
  'Doctor visit',
  'Therapy session',
  'Waiting',
  'Standing',
  'Sitting',
  'Reclining',
  'Sun exposure',
  'Swimming',
  'Being outdoors',
  'Being in crowds',
  'Shopping online',
  'Household admin',
  'Paying bills',
  'Organizing',
  'Travel preparation',
  'Packing',
];

// Common anti-seizure / rescue medication active ingredients (INN names, not translated).
// Shown as suggestions in the medication form; users can type any other ingredient.
export const COMMON_ANTISEIZURE_INGREDIENTS = [
  'acetazolamide', 'brivaracetam', 'cannabidiol', 'carbamazepine', 'cenobamate', 'clobazam',
  'clonazepam', 'diazepam', 'eslicarbazepine', 'ethosuximide', 'fenfluramine', 'gabapentin',
  'lacosamide', 'lamotrigine', 'levetiracetam', 'lorazepam', 'midazolam', 'oxcarbazepine',
  'perampanel', 'phenobarbital', 'phenytoin', 'pregabalin', 'primidone', 'rufinamide',
  'stiripentol', 'tiagabine', 'topiramate', 'valproate', 'vigabatrin', 'zonisamide',
];

// Built-in dosage forms; labels come from medication_forms.<key>. Custom forms are stored as typed.
export const MEDICATION_FORMS = [
  'tablet', 'capsule', 'liquid', 'granules', 'buccal', 'nasal', 'rectal', 'injection', 'patch', 'other',
];
