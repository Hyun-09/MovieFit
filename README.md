# MovieFit

사용자의 영화 취향을 조사하고 TMDB API 데이터를 이용해 맞춤 영화를 추천하는 모바일 웹앱.

## 기능

- 선호 장르 최대 4개
- 중요 요소: 스토리 / 캐릭터 / 영상미 / 감정
- 선호 속도: 느림 / 균형 / 빠름
- 선호 분위기: 따뜻함 / 어두움 / 웅장함 / 독특함
- 좋아하는 영화 최대 3개 검색 및 선택
- TMDB Discover + Recommendations + Similar Movies를 이용해 후보 생성
- 영화 상세정보의 배우/키워드/장르를 이용해 취향 점수 계산
- 모바일 반응형 UI

## 사용법

1. https://hyun-09.github.io/MovieFit/ 웹 사이트에 접속한다.
3. 첫 화면에 eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyZTM5OTg0ZmJlOWM0YWYyZGY5ZTI4ZmYyYjc4NGEzZSIsIm5iZiI6MTc4NzI5NzU3NS44NTIsInN1YiI6IjZhODdmZjI3YjI1MzZhMzYxNTQzMGFhNSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.pdYlA2STwAxSyDxL9Yot-h0Y0sRnaHghCUW0lgMP35g를 입력한다.
4. 취향을 조사한다.
5. 추천 결과를 확인한다.

TMDB 공식 문서:
https://developer.themoviedb.org/docs/getting-started

## 추천 알고리즘

최종 점수는 대략 다음 구조로 계산한다.

- 선호 장르 일치: 가장 큰 가중치
- 좋아한 영화와 배우 겹침: 캐릭터 중시 선택 시 가중치 증가
- 좋아한 영화와 키워드 겹침: 스토리 중시 선택 시 가중치 증가
- 좋아한 영화의 평균 평점과 비교
- 선호 분위기와 줄거리 신호 비교
- 인기도는 작은 보정값만 적용

즉, 단순히 "액션 좋아함 → 액션 영화 출력"이 아니라 사용자의 입력을 여러 영화 데이터 요소로 분해해 점수를 만든다.
