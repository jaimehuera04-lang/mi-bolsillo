/* ============================================================
   src/data/estacionales.js
   El calendario de lo que aprieta en Chile.

   Son DATOS, no lógica: no calculan ni dibujan nada. Sirven para
   que alguien no tenga que acordarse solo de que en marzo existe
   la matrícula, y pueda agregarla con un toque.

   Los montos son SUGERENCIAS de partida, no verdades: dependen
   del colegio, del auto y de la comuna. Por eso la pantalla los
   muestra como un campo editable y no como un dato cerrado.
   Poner una cifra ajena como si fuera la tuya es la forma más
   rápida de que la persona deje de creerle a la app.
   ============================================================ */

const Estacionales = (() => {

  /* mes va de 0 a 11, como en el resto del proyecto. */
  const PLANTILLAS = [
    { id: 'matricula',    emoji: '🎒', nombre: 'Matrícula y útiles',      mes: 2,  dia: 1,
      monto: 250000, categoria: 'educacion',
      pista: 'Matrícula, lista de útiles, uniformes y buzo. Lo más caro de marzo.' },

    { id: 'permiso',      emoji: '🚗', nombre: 'Permiso de circulación',  mes: 2,  dia: 31,
      monto: 120000, categoria: 'transporte',
      pista: 'Vence el 31 de marzo. La segunda cuota, en agosto.' },

    { id: 'permiso2',     emoji: '🚗', nombre: 'Permiso, segunda cuota',  mes: 7,  dia: 31,
      monto: 60000, categoria: 'transporte',
      pista: 'Solo si pagaste el permiso en dos cuotas.' },

    { id: 'contrib1',     emoji: '🏠', nombre: 'Contribuciones',          mes: 3,  dia: 30,
      monto: 90000, categoria: 'vivienda',
      pista: 'Abril, junio, septiembre y noviembre. Agrega las cuatro si te tocan.' },

    { id: 'revision',     emoji: '🔧', nombre: 'Revisión técnica',        mes: 4,  dia: 30,
      monto: 35000, categoria: 'transporte',
      pista: 'Según el último dígito de tu patente.' },

    { id: 'seguro',       emoji: '🛡️', nombre: 'Seguro del auto',         mes: 5,  dia: 1,
      monto: 350000, categoria: 'transporte',
      pista: 'Si lo pagas de una vez al año en vez de mensual.' },

    { id: 'fiestas',      emoji: '🇨🇱', nombre: 'Fiestas patrias',         mes: 8,  dia: 17,
      monto: 150000, categoria: 'ocio',
      pista: 'Asado, fondas, el 18 y el 19. Se va más de lo que uno cree.' },

    { id: 'navidad',      emoji: '🎁', nombre: 'Regalos de Navidad',      mes: 11, dia: 15,
      monto: 200000, categoria: 'regalo',
      pista: 'Empezar a guardar en septiembre duele mucho menos.' },

    { id: 'anonuevo',     emoji: '🎆', nombre: 'Fin de año',              mes: 11, dia: 30,
      monto: 100000, categoria: 'ocio',
      pista: 'La cena, el viaje corto, el 31.' },

    { id: 'vacaciones',   emoji: '🏖️', nombre: 'Vacaciones de verano',    mes: 0,  dia: 15,
      monto: 400000, categoria: 'ocio',
      pista: 'Enero o febrero, según cuándo te las den.' },

    { id: 'patente',      emoji: '🧾', nombre: 'Patente comercial',       mes: 0,  dia: 31,
      monto: 80000, categoria: 'otro',
      pista: 'Enero y julio, si tienes un negocio con patente municipal.' },

    { id: 'dental',       emoji: '🦷', nombre: 'Dentista',                mes: 6,  dia: 1,
      monto: 150000, categoria: 'salud',
      pista: 'El gasto que todos postergan hasta que duele.' },
  ];

  /** Las que caen en un mes, para poder decir "esto viene en marzo". */
  const delMes = mes => PLANTILLAS.filter(p => p.mes === mes);

  const porId = id => PLANTILLAS.find(p => p.id === id) || null;

  /**
   * Los meses que en Chile son caros, con su explicación.
   * Es lo que hace que el Modo Marzo diga POR QUÉ un mes aprieta y
   * no solo que aprieta.
   */
  const MESES_DUROS = {
    0:  'Enero: vacaciones y la patente si tienes negocio.',
    2:  'Marzo: matrícula, útiles, uniformes y el permiso de circulación. Es el mes más caro del año en Chile.',
    3:  'Abril: contribuciones.',
    7:  'Agosto: la segunda cuota del permiso de circulación.',
    8:  'Septiembre: el 18. Asado, fondas y tres días de gasto seguido.',
    11: 'Diciembre: regalos, cenas y fin de año.',
  };

  const porQueApreta = mes => MESES_DUROS[mes] || '';

  return { PLANTILLAS, delMes, porId, MESES_DUROS, porQueApreta };
})();

/* Para poder probarlo en Node sin navegador. */
if (typeof module !== 'undefined' && module.exports) module.exports = Estacionales;
