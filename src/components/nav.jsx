import  { Link } from 'react-router-dom';
import '../index.css';
export default function Nav() {

  return (
   <>
      <div className="flex flex-col md:flex-row justify-center items-center text-white text-2xl drop-shadow-md pb-2 space-y-2 md:space-y-0 md:space-x-12 w-fit mx-auto">
        <Link to="/listaMeteoritos" className="lilita hover:text-gray-300 transition-colors">
          Meteoritos
        </Link>
        <Link to="/simulaciones" className="lilita hover:text-gray-300 transition-colors">
          Simulaciones
        </Link>
      </div>
    </>
  );
}