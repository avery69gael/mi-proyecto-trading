import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const { email, coin, alert_type, alert_value } = await request.json();

    // Verificamos las variables de entorno para Resend
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Falta la clave de API de Resend.' }, { status: 500 });
    }
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Verificamos las variables de entorno para Supabase
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Faltan las claves de Supabase.' }, { status: 500 });
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Guardar la alerta en Supabase
    const { data, error: supabaseError } = await supabase
      .from('user_alerts')
      .insert([{
        email: email,
        coin: coin,
        alert_type: alert_type,
        alert_value: alert_value
      }]);

    if (supabaseError) {
      console.error('Error al insertar en Supabase:', supabaseError);
      return NextResponse.json({ error: 'Error al guardar la alerta en la base de datos.' }, { status: 500 });
    }

    // Enviar correo de confirmación
    const { data: resendData, error: resendError } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: [email],
      subject: 'Alerta de Trading Creada',
      html: `
        <h1>Confirmación de Alerta</h1>
        <p>Tu alerta para ${coin.toUpperCase()} ha sido creada con éxito.</p>
        <p>Recibirás una notificación cuando el precio o el RSI cumpla la condición de tu alerta (${alert_type} ${alert_value}).</p>
      `
    });

    if (resendError) {
      console.error('Error al enviar el email:', resendError);
      return NextResponse.json({ error: 'Error al enviar el correo de confirmación.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Alerta registrada y email de confirmación enviado.' }, { status: 200 });

  } catch (error) {
    console.error('Error general del servidor:', error);
    return NextResponse.json({ error: 'Ocurrió un error inesperado.' }, { status: 500 });
  }
}