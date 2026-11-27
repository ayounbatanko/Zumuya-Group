-- ZUMUYA GROUP — ajout du pôle Réseau social au gestionnaire des activités.
-- Migration additive et relançable : ne modifie aucun compte ni module existant.
insert into public.rg_module_catalog(module_code,label,description,rollout_status,sort_order)
values('social','Réseau social','Communauté ZUMUYA : publications, photos, vidéos, réactions, commentaires et abonnements.','available',5)
on conflict(module_code) do update set
 label=excluded.label,
 description=excluded.description,
 rollout_status='available',
 sort_order=excluded.sort_order,
 updated_at=now();
