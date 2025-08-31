#pragma once

#include "TSArray.h"
#include "TSBase.h"

#include <string>
#include <algorithm>
#include <iostream>

OC_GAME_API std::string __ts_string_substring(std::string const& str, double begin, double end = -1);
OC_GAME_API std::string __ts_string_substr(std::string const& str, double start, double end = -1);
OC_GAME_API std::string __ts_string_toUpperCase(std::string const& str);
OC_GAME_API std::string __ts_string_toLowerCase(std::string const& str);
OC_GAME_API bool __ts_string_startsWith(std::string const& str, std::string const& start);
OC_GAME_API bool __ts_string_endsWith(std::string const& str, std::string const& ending);
OC_GAME_API bool __ts_string_includes(std::string const& str, std::string const& sub);
OC_GAME_API std::string __ts_string_replace(std::string str, std::string const& from, std::string const& to);
OC_GAME_API std::string __ts_string_replaceAll(std::string str, std::string const& from, std::string const& to);
OC_GAME_API double __ts_string_indexOf(std::string const& str, std::string const& sub);
OC_GAME_API double __ts_string_lastIndexOf(std::string const& str, std::string const& sub);
OC_GAME_API std::string __ts_string_charAt(std::string const& str, double index);
OC_GAME_API double __ts_string_length(std::string const& str);
OC_GAME_API TSArray<std::string> __ts_string_split(std::string const& str, std::string const& delim);
