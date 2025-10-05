import React, { useState, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = "AIzaSyBipiiU3HACmSxboLPA1infuhXXicWjQUE"; 

const SYSTEM_TEXT = `Quiero darte datos clave sobre un meteorito. Con base exclusivamente en esos datos, genera dos secciones de salida: “CONSECUENCIAS” y “MITIGACIONES”. No agregues texto introductorio ni conclusiones fuera de esas secciones.

En “CONSECUENCIAS”, describe en menos de 3 viñetas los efectos más probables si: (a) impacta en tierra o en océano (por ejemplo, onda de choque, daños estructurales, incendios, tsunami, interrupciones de servicios), (b) explota en la atmósfera (por ejemplo, rotura de vidrios, onda de presión, irritación/afectación respiratoria por partículas finas), o (c) se desintegra sin efectos relevantes. Si, según los datos, el evento es irrelevante, indícalo claramente (“Sin consecuencias relevantes previstas”) y no inventes impactos.

En “MITIGACIONES”, propone en menos de 3 viñetas acciones realistas y proporcionales al caso (por ejemplo, seguimiento y alertas tempranas, evacuaciones y cierres temporales en zonas de riesgo, desvío mediante impacto cinético o tracción gravitacional; considerar explosión controlada solo si el tamaño/composición/ventana temporal lo permiten). Si el caso es irrelevante, indica que no se requiere acción.

Usa frases cortas, precisas y puntuales. No repitas datos de entrada. No incluyas advertencias legales ni comentarios meta. Si la información es incierta (p. ej., probabilidad de impacto baja), exprésalo con lenguaje probabilístico (“probable”, “posible”, “poco probable”).`;

function Chat() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  // 1) Instancia y modelo con systemInstruction
  const genAIRef = useRef(new GoogleGenerativeAI(API_KEY));
  const modelRef = useRef(
    genAIRef.current.getGenerativeModel({
      model: "gemini-2.5-flash",
      // Puedes pasar string o parts; ambos son válidos
      systemInstruction: { parts: [{ text: SYSTEM_TEXT }] },
      // (Opcional) tools si usarás function-calling:
      // tools,
    })
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await modelRef.current.generateContent(prompt);
      setResponse(result.response.text());
    } catch (err) {
      console.error(err);
      setResponse("Error: Could not generate content.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Pega aquí los datos del meteorito…"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </form>
      {response && (
        <div>
          <h3>Gemini's Response:</h3>
          <pre style={{whiteSpace:'pre-wrap'}}>{response}</pre>
        </div>
      )}
    </div>
  );
}

export default Chat;
