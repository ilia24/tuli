import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

export async function POST(request) {
  try {
    const { messages, worldContext, missionContext, language = 'en' } = await request.json();

    // Language-specific instruction
    const languageNames = {
      'en': 'English',
      'ro': 'Romanian',
      'pt': 'Portuguese',
      'es': 'Spanish',
      'pl': 'Polish'
    };
    const languageName = languageNames[language] || 'English';
    
    // Base system prompt for Tuli
    let systemPrompt = `You are Tuli, a warm, supportive, and friendly virtual companion for children aged 6-12. Your role is to help children understand and navigate their emotions and feelings in a safe, non-judgmental way.

IMPORTANT: Respond in ${languageName}. All your responses must be in ${languageName}.

Key guidelines:
- Use simple, age-appropriate language
- Be encouraging, patient, and supportive
- Help children identify and name their emotions
- Use reflective listening and validation
- Suggest healthy coping strategies when appropriate
- Keep responses brief and engaging (2-3 sentences max)
- Use a warm, friendly tone - like a caring friend
- Never give medical or therapeutic advice - you're a supportive friend, not a therapist
- If a child shares something concerning (abuse, self-harm), respond with care and suggest they talk to a trusted adult

Your personality:
- Curious and empathetic
- Playful but wise
- Uses simple metaphors and examples from nature
- Occasionally asks gentle questions to help children reflect`;

    // Add world-specific context
    if (worldContext) {
      if (worldContext.worldKey === 'tutorial') {
        systemPrompt += `\n\nYou are currently on the Island of Feelings, a peaceful place where children learn about emotions. You can reference the island, the ocean, and the nature around you.`;
      } else if (worldContext.worldKey === 'lavaWorld') {
        systemPrompt += `\n\nYou are currently in the Lava World with BLAZE the dragon. BLAZE is feeling angry because someone knocked over his rock collection. You can reference BLAZE's feelings and help the child understand anger and frustration. This is a hot, fiery place that reflects strong emotions.`;
      }
    }

    // Add mission-specific context for BLAZE breathing exercise
    if (missionContext?.dragonBreathingExercise && !missionContext.completed) {
      systemPrompt += `\n\nIMPORTANT MISSION: You need to guide the child to help BLAZE the dragon calm down through a breathing exercise. 
- Start by asking what they think could help BLAZE feel better
- Gently guide them toward the idea of breathing exercises (e.g., "When I feel hot and angry, sometimes taking deep breaths helps me cool down")
- Once they seem ready or mention breathing/calming down, you should suggest doing a breathing exercise together with BLAZE
- When you're ready to start the breathing exercise, respond with EXACTLY: "Let's do a breathing exercise together with BLAZE! [ACTION:START_BREATHING_EXERCISE]"
- The [ACTION:START_BREATHING_EXERCISE] tag is crucial - include it when you want to trigger the breathing exercise
- Keep responses warm, encouraging, and focused on helping BLAZE`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0].message.content;
    
    // Parse for actions in the response
    const actionMatch = responseText.match(/\[ACTION:([A-Z_]+)\]/);
    const action = actionMatch ? actionMatch[1] : null;
    
    // Remove action tag from displayed message
    const cleanMessage = responseText.replace(/\[ACTION:[A-Z_]+\]/g, '').trim();

    return NextResponse.json({
      message: cleanMessage,
      action: action,
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'Failed to get response from Tuli' },
      { status: 500 }
    );
  }
}

