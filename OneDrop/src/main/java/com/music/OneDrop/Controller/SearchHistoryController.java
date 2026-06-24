package com.music.OneDrop.Controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.music.OneDrop.model.SearchHistoryEntry;
import com.music.OneDrop.repository.SearchHistoryRepository;

@RestController
@RequestMapping("/api/history")
public class SearchHistoryController {

    private static final int MAX_HISTORY = 10;

    private final SearchHistoryRepository repo;

    public SearchHistoryController(SearchHistoryRepository repo) {
        this.repo = repo;
    }

    @GetMapping("/{source}")
    public ResponseEntity<List<String>> getHistory(@PathVariable String source) {
        List<String> queries = repo
            .findTop10BySourceOrderBySearchedAtDesc(source)
            .stream()
            .map(SearchHistoryEntry::getQuery)
            .toList();
        return ResponseEntity.ok(queries);
    }

    // @Transactional ensures all repo calls share one persistence context —
    // the count after the delete sees the correct number of remaining rows.
  @PostMapping("/{source}")
@Transactional
public ResponseEntity<Void> addEntry(
        @PathVariable String source,
        @RequestBody Map<String, String> body) {

    String query = body.get("query");
    if (query == null || query.isBlank()) return ResponseEntity.badRequest().build();
    query = query.trim();

    // 1. Delete existing duplicate using find + deleteAll (no JPQL)
  

    // 2. Save new entry
    repo.save(new SearchHistoryEntry(source, query));
    repo.flush();

 
    return ResponseEntity.ok().build();
}

// clearHistory — same fix:
@DeleteMapping("/{source}/all")
@Transactional
public ResponseEntity<Void> clearHistory(@PathVariable String source) {
    repo.deleteAll(repo.findBySourceOrderBySearchedAtAsc(source));
    repo.flush();
    System.out.println("Cleared history for source: " + source);
    return ResponseEntity.ok().build();
}

// removeEntry — same fix:
@DeleteMapping("/{source}")
@Transactional
public ResponseEntity<Void> removeEntry(
        @PathVariable String source,
        @RequestParam String query) {
    List<SearchHistoryEntry> entries = repo.findBySourceAndQueryIgnoreCase(source, query);
    repo.deleteAll(entries);
    System.out.println("Removed entry for source: " + source + ", query: " + query);
    repo.flush();
    return ResponseEntity.ok().build();
}



}