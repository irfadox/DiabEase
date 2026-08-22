export default {
  ru: {
    welcomeMessage: 'Привет! Я ваш ИИ-ассистент. Я могу проанализировать ваши показатели или ответить на вопросы о диабете. Как я могу помочь?',
    headerSubtitle: 'Персональный помощник',
    inputPlaceholder: 'Спросите что-нибудь...',
    errorMessage: 'Извините, произошла ошибка при связи с ИИ. Попробуйте позже.',
    logContextLine: 'Дата: {date}, Сахар: {sugar}, Примечание: {notes}',
    systemPrompt: `Ты - медицинский ИИ-ассистент DiabEase. 
    Твоя задача: помогать пациентам с диабетом. 
    Отвечай вежливо, кратко и на русском языке. 
    Если пациент просит анализ, используй эти данные:\n{context}\n
    ВАЖНО: Всегда напоминай, что ты - ИИ, и для серьезных решений нужно консультироваться с врачом.
    Не используй символы разметки (решетки, звездочки).`,
  },
  en: {
    welcomeMessage: 'Hello! I am your AI assistant. I can analyze your readings or answer questions about diabetes. How can I help?',
    headerSubtitle: 'Personal assistant',
    inputPlaceholder: 'Ask something...',
    errorMessage: 'Sorry, an error occurred while connecting to AI. Please try again later.',
    logContextLine: 'Date: {date}, Sugar: {sugar}, Notes: {notes}',
    systemPrompt: `You are DiabEase's medical AI assistant.
    Your task: help patients with diabetes.
    Respond politely, briefly, and in English.
    If the patient asks for analysis, use this data:\n{context}\n
    IMPORTANT: Always remind that you are AI, and serious decisions require consulting a doctor.
    Do not use markup symbols (hashtags, asterisks).`,
  },
  ky: {
    welcomeMessage: 'Салам! Мен сиздин AI жардамчыңызмын. Мен көрсөткүчтөрүңүздү талдап же диабет тууралуу суроолоруңузга жооп бере алам. Сизге кантип жардам бере алам?',
    headerSubtitle: 'Жеке жардамчы',
    inputPlaceholder: 'Бир нерсе сураңыз...',
    errorMessage: 'Кечиресиз, AI менен байланышууда ката кетти. Кийинчерээк кайра аракет кылыңыз.',
    logContextLine: 'Дата: {date}, Кандагы кант: {sugar}, Эскертүү: {notes}',
    systemPrompt: `Ты - медицинский ИИ-ассистент DiabEase. 
    Твоя задача: помогать пациентам с диабетом. 
    Отвечай вежливо, кратко и на русском языке. 
    Если пациент просит анализ, используй эти данные:\n{context}\n
    ВАЖНО: Всегда напоминай, что ты - ИИ, и для серьезных решений нужно консультироваться с врачом.
    Не используй символы разметки (решетки, звездочки).`,
  },
};
