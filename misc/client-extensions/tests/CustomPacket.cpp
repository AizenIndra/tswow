﻿#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_all.hpp >

#include "CustomPacketWrite.h"
#include "CustomPacketRead.h"
#include <iostream>

TEST_CASE("[MessageBase] initialize") {
  SECTION("with chunkSize=1 and size=0") {
    CustomPacketWrite message(0, CustomHeaderSize + 1, 0);
    SECTION("has size of 0") {
      REQUIRE(message.Size() == 0);
    }

    SECTION("has no chunks") {
      REQUIRE(message.ChunkCount() == 0);
    }
  }

  SECTION("with chunkSize=1 and size=1") {
    CustomPacketWrite message(0, CustomHeaderSize + 1, 1);
    SECTION("has size of 1") {
      REQUIRE(message.Size() == 1);
    }

    SECTION("has 1 chunk") {
      REQUIRE(message.ChunkCount() == 1);
    }
  }

  SECTION("with chunkSize=1 and size=2") {
    CustomPacketWrite message(0, CustomHeaderSize + 1, 2);
    SECTION("has size of 2") {
      REQUIRE(message.Size() == 2);
    }

    SECTION("has 2 chunks") {
      REQUIRE(message.ChunkCount() == 2);
    }
  }
}

TEST_CASE("[MessageBase] read/write") {
  SECTION("pre-allocated") {
    SECTION("single chunk") {
      CustomPacketWrite message(0, CustomHeaderSize + 16, 10);
      REQUIRE(message.ChunkCount() == 1); // sanity

      SECTION("single value") {
        message.Write<uint16_t>(1768);
        REQUIRE(CustomPacketRead(message).Read<uint16_t>(0) == 1768);
      }

      SECTION("multiple values") {
        message.Write<uint16_t>(1768);
        message.Write<uint16_t>(8671);
        CustomPacketRead read(message);
        REQUIRE(read.Read<uint16_t>(0) == 1768);
        REQUIRE(read.Read<uint16_t>(0) == 8671);
      }

      SECTION("single string") {
        message.WriteString("abcd");
        REQUIRE_THAT(
            CustomPacketRead(message).ReadString()
          , Catch::Matchers::Equals("abcd")
        );
      }

      SECTION("multiple strings") {
        message.WriteString("abcd");
        message.WriteString("efgh");
        CustomPacketRead read(message);
        REQUIRE_THAT(read.ReadString(), Catch::Matchers::Equals("abcd"));
        REQUIRE_THAT(read.ReadString(), Catch::Matchers::Equals("efgh"));
      }
    }

    SECTION("multiple chunks (aligned)") {
      CustomPacketWrite message(0, CustomHeaderSize + 2, 4);
      SECTION("single value") {
        message.Write<uint16_t>(1768);
        REQUIRE(CustomPacketRead(message).Read<uint16_t>(0) == 1768);
      }

      SECTION("multiple values") {
        message.Write<uint16_t>(1768);
        message.Write<uint16_t>(8671);
        CustomPacketRead read(message);
        REQUIRE(message.ChunkCount() == 2); // sanity
        REQUIRE(read.Read<uint16_t>(0) == 1768);
        REQUIRE(read.Read<uint16_t>(0) == 8671);
      }

      SECTION("single string") {
        CustomPacketWrite strMessage(0, CustomHeaderSize + 8, 16);
        strMessage.WriteString("abcdefgh");
        CustomPacketRead read(strMessage);
        REQUIRE(message.ChunkCount() == 2); // sanity
        REQUIRE_THAT(read.ReadString(), Catch::Matchers::Equals("abcdefgh"));
      }

      SECTION("multiple strings") {
        CustomPacketWrite strMessage(0, CustomHeaderSize + 8, 16);
        strMessage.WriteString("abcd");
        strMessage.WriteString("efgh");
        CustomPacketRead read(strMessage);
        REQUIRE(message.ChunkCount() == 2); // sanity
        REQUIRE_THAT(read.ReadString(), Catch::Matchers::Equals("abcd"));
        REQUIRE_THAT(read.ReadString(), Catch::Matchers::Equals("efgh"));
      }
    }

    SECTION("multiple chunks (misaligned)") {
      SECTION("multiple values") {
        CustomPacketWrite message(0, CustomHeaderSize + 2, 6);
        message.Write<uint8_t>(25);
        message.Write<uint16_t>(1768);
        message.Write<uint16_t>(8671);
        CustomPacketRead read(message);
        REQUIRE(message.ChunkCount() == 3); // sanity
        REQUIRE(read.Read<uint8_t>(0) == 25);
        REQUIRE(read.Read<uint16_t>(0) == 1768);
        REQUIRE(read.Read<uint16_t>(0) == 8671);
      }

      SECTION("single string") {
        CustomPacketWrite strMessage(0, CustomHeaderSize + 8, 16);
        strMessage.Write<uint32_t>(0);
        strMessage.Write<uint8_t>(0); // forces string to start on chunk 2
        strMessage.WriteString("abcd");

        CustomPacketRead read(strMessage);
        read.Read<uint32_t>(0);
        read.Read<uint8_t>(0);
        REQUIRE(read.ChunkCount() == 2); // sanity
        REQUIRE_THAT(read.ReadString(), Catch::Matchers::Equals("abcd"));
      }
    }
  }

  SECTION("partial allocation") {
    SECTION("single chunk") {
      CustomPacketWrite message(0, MAX_FRAGMENT_SIZE, 1);
      SECTION("single value") {
        message.Write<uint16_t>(1768);
        CustomPacketRead read = CustomPacketRead(message);
        REQUIRE(read.ChunkCount() == 1); // sanity
        REQUIRE(read.Read<uint16_t>(0) == 1768);
      }

      SECTION("string") {
          message.WriteString("test",4);
          REQUIRE(message.Size() == 8);
          CustomPacketRead read = CustomPacketRead(message);
          REQUIRE_THAT(read.ReadString(), Catch::Matchers::Equals("test"));
      }

      SECTION("multiple values") {
        // skips the first one
        message.Write<uint16_t>(1768);
        message.Write<uint8_t>(25);
        // skips the second one
        message.Write<uint16_t>(8671);
        CustomPacketRead read = CustomPacketRead(message);
        REQUIRE(read.ChunkCount() == 1); // sanity
        REQUIRE(read.Read<uint16_t>(0) == 1768);
        REQUIRE(read.Read<uint8_t>(0) == 25);
        REQUIRE(read.Read<uint16_t>(0) == 8671);
      }
    }

    SECTION("multiple chunks") {
      CustomPacketWrite message(0, CustomHeaderSize + 2, 1);
      SECTION("multiple values") {
        // skips the first one
        message.Write<uint16_t>(1768);
        message.Write<uint8_t>(25);
        // skips the second one
        message.Write<uint16_t>(8671);
        CustomPacketRead read = CustomPacketRead(message);
        REQUIRE(read.ChunkCount() == 3); // sanity
        REQUIRE(read.Read<uint16_t>(0) == 1768);
        REQUIRE(read.Read<uint8_t>(0) == 25);
        REQUIRE(read.Read<uint16_t>(0) == 8671);
      }

      SECTION("string") {
          message.WriteString("hello world everyone!");
          CustomPacketRead read = CustomPacketRead(message);
          REQUIRE_THAT(read.ReadString(), Catch::Matchers::Equals("hello world everyone!"));
      }
    }
  }
}

TEST_CASE("[MessageBase] Size") {
    SECTION("Aligned") {
        SECTION("Single chunk Write") {
            CustomPacketWrite write = CustomPacketWrite(0, MAX_FRAGMENT_SIZE, 0);
            REQUIRE(write.Size() == 0);
            write.Write<uint32_t>(0);
            REQUIRE(write.Size() == 4);
            write.Write<uint64_t>(0);
            REQUIRE(write.Size() == 12);
        }

        SECTION("Single chunk WriteString") {
            std::string str = "";
            for (size_t i = 0; i < 100; ++i)
            {
                CustomPacketWrite write = CustomPacketWrite(0, MAX_FRAGMENT_SIZE, 0);
                REQUIRE(write.Size() == 0);
                write.WriteString(str);
                REQUIRE(write.Size() == str.size() + 4);
                str += "a";
            }
        }

        SECTION("Multiple chunks Write") {
            CustomPacketWrite write = CustomPacketWrite(0, 8, 0);
            REQUIRE(write.Size() == 0);
            write.Write<uint64_t>(0);
            REQUIRE(write.Size() == 8);
            write.Write<uint64_t>(0);
            REQUIRE(write.Size() == 16);
        }

        SECTION("Multiple chunks WriteString") {
            std::string str = "";
            for (size_t i = 0; i < 100; ++i)
            {
                CustomPacketWrite write = CustomPacketWrite(0, 8, 0);
                write.WriteString(str);
                REQUIRE(write.Size() == str.size() + 4);
            }
        }
    }

    SECTION("Misaligned") {
        SECTION("Single chunk write") {
            CustomPacketWrite write = CustomPacketWrite(0, 5+CustomHeaderSize, 0);
            REQUIRE(write.Size() == 0);
            write.Write<uint32_t>(1007688);
            REQUIRE(write.Size() == 4);
            write.Write<uint32_t>(1007688);
            REQUIRE(write.Size() == 4+4);
        }

        SECTION("Single chunk preloaded Write") {
            CustomPacketWrite write = CustomPacketWrite(0, 5 + CustomHeaderSize, 5);
            REQUIRE(write.Size() == 5);
            write.Write<uint32_t>(1007688);
            REQUIRE(write.Size() == 5);
            write.Write<uint32_t>(1007688);
            REQUIRE(write.Size() == 4 + 4);
        }

        SECTION("Single chunk WriteString") {
            std::string str = "";
            for (size_t i = 0; i < 100; ++i)
            {
                CustomPacketWrite write = CustomPacketWrite(0, 5 + CustomHeaderSize, 0);
                write.WriteString(str);
                REQUIRE(write.Size() == str.size() + 4);
                str += "a";
            }
        }

        SECTION("Single chunk preloaded WriteString") {
            std::string str = "";
            for (size_t i = 0; i < 100; ++i)
            {
                CustomPacketWrite write = CustomPacketWrite(0, 5 + CustomHeaderSize, 5);
                write.Write<uint32_t>(1007688);
                write.WriteString(str);
                REQUIRE(write.Size() == str.size() + 4 + 4);
                str += "a";
            }
        }
    }
}

