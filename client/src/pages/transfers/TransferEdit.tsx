import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function TransferEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to detail page for now - editing is done inline
    if (id) navigate(`/transfers/requests/${id}`, { replace: true });
  }, [id, navigate]);

  return <div className="p-8 text-center text-muted-foreground">Redirigiendo...</div>;
}
