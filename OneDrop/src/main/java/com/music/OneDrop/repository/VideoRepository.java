package com.music.OneDrop.repository;


import com.music.OneDrop.model.VideoEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Interface Repository pour l'entité VideoEntry.
 * Elle utilise Spring Data JPA pour fournir automatiquement les méthodes de persistance.
 *
 * JpaRepository<T, ID> prend deux types génériques:
 * 1. T: Le type de l'entité (VideoEntry)
 * 2. ID: Le type de la clé primaire de l'entité (String, qui est videoId)
 */
@Repository
public interface VideoRepository extends JpaRepository<VideoEntry, String> {

    /**
     * Méthode personnalisée pour récupérer toutes les vidéos, triées par la date de traitement décroissante.
     * Spring Data JPA génère automatiquement la requête SQL à partir du nom de la méthode.
     */
    List<VideoEntry> findAllByOrderByProcessedAtDesc();
    
    // Vous pouvez ajouter d'autres méthodes de recherche ici si nécessaire (ex: findByStatus)
}
