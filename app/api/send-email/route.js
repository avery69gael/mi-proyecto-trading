import { Resend } from 'resend';
import { NextResponse } from 'next/server';

// Inicializa la conexión con Resend usando la clave de entorno
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  const { email, coin, alert_type, alert_value } = await req.json();

  // Verificamos que los datos necesarios están presentes
  if (!email || !coin || !alert_type || !alert_value) {
    return NextResponse.json({ message: 'Faltan parámetros' }, { status: 400 });
  }

  try {
    // Definimos el contenido del correo electrónico
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev', // Puedes cambiar esta dirección más tarde
      to: email,
      subject: `Alerta de ${coin.toUpperCase()} activada`,
      html: `
        <p>Hola,</p>
        <p>Tu alerta para **${coin.toUpperCase()}** se ha activado.</p>
        <p><strong>Tipo de alerta:</strong> ${alert_type}</p>
        <p><strong>Valor:</strong> ${alert_value}</p>
        <p>La condición de tu alerta ha sido alcanzada. ¡Es hora de actuar!</p>
        <p>Saludos,</p>
        <p>El equipo de Trading Dashboard</p>
      `,
    });

    // Enviamos una respuesta de éxito
    return NextResponse.json({ message: 'Email enviado con éxito', data }, { status: 200 });
  } catch (error) {
    console.error('Error al enviar el email:', error);
    return NextResponse.json({ message: 'Error interno del servidor', error: error.message }, { status: 500 });
  }
}